-- Runs a user's init.lua against a stubbed `vim` global and returns, as JSON,
-- what the config did: leader keys, lazy.nvim plugin specs and key mappings.
-- The config text is read from the global `__config_source`.

local getinfo = debug.getinfo
local sethook = debug.sethook
local clock = os.clock
local time_limit = __config_time_limit or 2
__config_time_limit = nil
local source = __config_source
__config_source = nil

local ARRAY = {}
local function arr(t) return setmetatable(t or {}, ARRAY) end

local rec = {
  plugins = arr(),
  mappings = arr(),
  warnings = arr(),
}
local seen_plugins = {}
local deferred = {}     -- functions to call once the config has finished
local recording = nil   -- list of references while a mapping's function runs

local function warn(message, line)
  rec.warnings[#rec.warnings + 1] = { message = message, line = line }
end

-- The line of init.lua that is currently executing, if any.
local function config_line()
  for level = 2, 30 do
    local info = getinfo(level, 'Sl')
    if not info then return nil end
    if info.source == '=init.lua' and info.currentline and info.currentline > 0 then
      return info.currentline
    end
  end
end

---------------------------------------------------------------------------
-- Proxies: values that accept any field access or call, and remember the
-- path that led to them (`telescope.builtin.find_files`).

local paths = setmetatable({}, { __mode = 'k' })
local proxy_mt = {}

local function new_proxy(path)
  local proxy = setmetatable({}, proxy_mt)
  paths[proxy] = path
  return proxy
end

local function is_proxy(value)
  return type(value) == 'table' and paths[value] ~= nil
end

local function format_arg(value)
  if type(value) == 'string' then return "'" .. value .. "'" end
  if type(value) == 'number' or type(value) == 'boolean' then return tostring(value) end
end

local call_hooks = {}

local function run_on_attach(tbl)
  if type(tbl) == 'table' and not is_proxy(tbl) and type(rawget(tbl, 'on_attach')) == 'function' then
    deferred[#deferred + 1] = function() tbl.on_attach(0) end
  end
end

proxy_mt.__index = function(self, key)
  -- Numeric keys are absent, so ipairs() over a proxy ends at once.
  if type(key) ~= 'string' then return nil end
  return new_proxy(paths[self] .. '.' .. key)
end

proxy_mt.__call = function(self, ...)
  local path = paths[self]
  local first = ...
  -- obj:method(arg) passes obj first.
  if is_proxy(first) then first = select(2, ...) end
  if recording and path:sub(1, 4) ~= 'vim.' then
    local arg = format_arg(first)
    if arg then recording[#recording + 1] = path .. '(' .. arg .. ')' end
    recording[#recording + 1] = path
  end
  local hook = call_hooks[path]
  if hook then return hook(...) end
  if not recording then run_on_attach(first) end
  return new_proxy(path .. '()')
end

proxy_mt.__concat = function(a, b)
  return (is_proxy(a) and '' or tostring(a)) .. (is_proxy(b) and '' or tostring(b))
end
proxy_mt.__tostring = function(self) return paths[self] end
proxy_mt.__len = function() return 0 end
proxy_mt.__eq = function(a, b) return rawequal(a, b) end
proxy_mt.__lt = function() return false end
proxy_mt.__le = function() return false end
proxy_mt.__unm = function() return 0 end
for _, op in ipairs({ 'add', 'sub', 'mul', 'div', 'mod', 'pow', 'idiv', 'band', 'bor', 'bxor', 'shl', 'shr' }) do
  proxy_mt['__' .. op] = function() return 0 end
end

---------------------------------------------------------------------------
-- Mappings

local function mode_list(mode)
  local modes = arr()
  if type(mode) == 'string' then
    if mode == '' then modes[1], modes[2], modes[3] = 'n', 'v', 'o' else modes[1] = mode end
  elseif type(mode) == 'table' then
    for _, m in ipairs(mode) do
      if type(m) == 'string' then modes[#modes + 1] = m end
    end
  end
  if #modes == 0 then modes[1] = 'n' end
  return modes
end

local function record_mapping(mode, lhs, rhs, opts, origin)
  if type(lhs) ~= 'string' or lhs == '' then return end
  if type(opts) ~= 'table' or is_proxy(opts) then opts = {} end
  if rhs == nil and opts.callback ~= nil then rhs = opts.callback end
  local mapping = { modes = mode_list(mode), lhs = lhs, origin = origin, line = config_line() }
  if type(opts.desc) == 'string' and opts.desc ~= '' then mapping.desc = opts.desc end
  if type(rhs) == 'string' then
    mapping.rhs = rhs
  elseif is_proxy(rhs) then
    mapping.refs = arr({ paths[rhs] })
  elseif type(rhs) == 'function' then
    -- Call the function with recording on, to learn which plugin functions it uses.
    local outer = recording
    recording = arr()
    pcall(rhs)
    mapping.refs = recording
    recording = outer
  else
    return
  end
  rec.mappings[#rec.mappings + 1] = mapping
end

local MAP_FLAGS = { '<silent>', '<buffer>', '<expr>', '<nowait>', '<unique>', '<script>', '<special>' }

-- Reads `nnoremap <leader>x ...`-style lines from a vim.cmd string.
local function record_vimscript(text)
  for line in (text .. '\n'):gmatch('(.-)\r?\n') do
    local mode, rest = line:match('^%s*([nvxsoilct]?)noremap%s+(.+)$')
    if not mode then mode, rest = line:match('^%s*([nvxsoilct]?)map%s+(.+)$') end
    if mode then
      local stripped = true
      while stripped do
        stripped = false
        for _, flag in ipairs(MAP_FLAGS) do
          if rest:sub(1, #flag):lower() == flag then
            rest = rest:sub(#flag + 1):gsub('^%s+', '')
            stripped = true
          end
        end
      end
      local lhs, rhs = rest:match('^(%S+)%s+(.-)%s*$')
      if lhs and rhs ~= '' then record_mapping(mode, lhs, rhs, nil, nil) end
    end
  end
end

---------------------------------------------------------------------------
-- lazy.nvim plugin specs

local function safe_call(label, fn, ...)
  local ok, result = pcall(fn, ...)
  if ok then return result end
  warn(label .. ' failed: ' .. tostring(result))
end

local function is_list(tbl)
  for key in pairs(tbl) do
    if type(key) ~= 'number' then return false end
  end
  return true
end

local function repo_name(name)
  name = name:gsub('^https?://github%.com/', ''):gsub('^git@github%.com:', ''):gsub('%.git$', '')
  return name
end

local handle_spec

local function handle_plugin(spec)
  local name = repo_name(spec[1])
  if spec.enabled == false or spec.cond == false then return end
  if not seen_plugins[name] then
    seen_plugins[name] = true
    rec.plugins[#rec.plugins + 1] = name
  end

  local deps = spec.dependencies
  if type(deps) == 'string' then handle_spec(deps) elseif type(deps) == 'table' then handle_spec(deps) end

  local keys = spec.keys
  if type(keys) == 'function' then keys = safe_call(name .. ': keys', keys, spec, arr()) end
  if type(keys) == 'table' and not is_proxy(keys) then
    for _, key in ipairs(keys) do
      if type(key) == 'table' and key[2] ~= nil then
        record_mapping(key.mode or 'n', key[1], key[2], { desc = key.desc }, name)
      end
    end
  end

  if type(spec.init) == 'function' then safe_call(name .. ': init', spec.init, spec) end

  local opts = spec.opts
  if type(opts) == 'function' then
    local base = {}
    opts = safe_call(name .. ': opts', opts, spec, base) or base
  end
  if type(spec.config) == 'function' then
    safe_call(name .. ': config', spec.config, spec, opts or {})
  else
    run_on_attach(opts)
  end
end

handle_spec = function(spec)
  if type(spec) == 'string' then
    handle_plugin({ spec })
  elseif type(spec) == 'table' and not is_proxy(spec) then
    if #spec > 1 or (next(spec) ~= nil and is_list(spec)) then
      for _, child in ipairs(spec) do handle_spec(child) end
    elseif type(spec[1]) == 'string' then
      handle_plugin(spec)
    elseif type(spec.import) == 'string' then
      warn('lazy.nvim imports "' .. spec.import .. '", but only this one file is read, so plugins and mappings defined there are not seen.')
    end
  end
end

call_hooks['lazy.setup'] = function(spec)
  local line = config_line()
  if type(spec) == 'string' then
    warn('lazy.nvim loads plugin specs from "' .. spec .. '", but only this one file is read, so plugins and mappings defined there are not seen.', line)
  elseif type(spec) == 'table' and not is_proxy(spec) then
    if spec.spec ~= nil then handle_spec(spec.spec) else handle_spec(spec) end
  end
end

---------------------------------------------------------------------------
-- The `vim` global

local noop = function() end

-- Option tables: `vim.wo.diff` reads as nil, `vim.bo[0].filetype` works.
local function option_table()
  return setmetatable({}, {
    __index = function(_, key)
      if type(key) == 'number' then return option_table() end
    end,
  })
end

local function defer(fn)
  if type(fn) == 'function' then deferred[#deferred + 1] = fn end
end

local function tbl_extend_impl(deep, behavior, ...)
  local result = {}
  for i = 1, select('#', ...) do
    local tbl = select(i, ...)
    if type(tbl) == 'table' then
      for key, value in pairs(tbl) do
        if deep and type(value) == 'table' and type(result[key]) == 'table'
          and not is_proxy(value) and not is_proxy(result[key]) then
          result[key] = tbl_extend_impl(true, behavior, result[key], value)
        elseif behavior ~= 'keep' or result[key] == nil then
          result[key] = value
        end
      end
    end
  end
  return result
end

local function deepcopy(value)
  if type(value) ~= 'table' or is_proxy(value) then return value end
  local copy = {}
  for k, v in pairs(value) do copy[k] = deepcopy(v) end
  return copy
end

local cmd = setmetatable({}, {
  __call = function(_, command)
    if type(command) ~= 'string' then return end
    if recording then
      recording[#recording + 1] = command
    else
      record_vimscript(command)
    end
  end,
  __index = function(_, name)
    return function(...)
      if recording and type(name) == 'string' then
        local parts = { name }
        for i = 1, select('#', ...) do
          local arg = select(i, ...)
          if type(arg) == 'string' then parts[#parts + 1] = arg end
        end
        recording[#recording + 1] = table.concat(parts, ' ')
      end
    end
  end,
})

local fn = new_proxy('vim.fn')
rawset(fn, 'stdpath', function() return '/nvim' end)
rawset(fn, 'has', function() return 1 end)
rawset(fn, 'executable', function() return 1 end)
rawset(fn, 'exists', function() return 0 end)
rawset(fn, 'expand', function() return '' end)
rawset(fn, 'getcwd', function() return '/' end)
rawset(fn, 'system', function() return '' end)
rawset(fn, 'glob', function() return '/nvim' end)
rawset(fn, 'empty', function(value)
  if value == nil or value == '' or value == 0 then return 1 end
  if type(value) == 'table' and next(value) == nil then return 1 end
  return 0
end)
rawset(fn, 'isdirectory', function() return 1 end)
rawset(fn, 'filereadable', function() return 0 end)

local loop = new_proxy('vim.loop')
rawset(loop, 'fs_stat', function() return { type = 'directory' } end)
rawset(loop, 'os_uname', function() return { sysname = 'Linux', machine = 'x86_64', release = '', version = '' } end)

local api = new_proxy('vim.api')
rawset(api, 'nvim_set_keymap', function(mode, lhs, rhs, opts) record_mapping(mode, lhs, rhs, opts) end)
rawset(api, 'nvim_buf_set_keymap', function(_, mode, lhs, rhs, opts) record_mapping(mode, lhs, rhs, opts) end)
rawset(api, 'nvim_create_augroup', function() return 1 end)
rawset(api, 'nvim_create_autocmd', function(_, opts)
  -- Autocommand callbacks (LspAttach and the like) often define mappings.
  if type(opts) == 'table' and type(opts.callback) == 'function' then
    local callback = opts.callback
    defer(function() callback({ buf = 0, id = 1, event = '', match = '', file = '', data = new_proxy('vim.autocmd.data') }) end)
  end
  return 1
end)
rawset(api, 'nvim_create_user_command', noop)
rawset(api, 'nvim_get_current_buf', function() return 0 end)
rawset(api, 'nvim_get_current_win', function() return 0 end)
rawset(api, 'nvim_list_bufs', function() return {} end)
rawset(api, 'nvim_list_wins', function() return {} end)

local keymap = new_proxy('vim.keymap')
rawset(keymap, 'set', function(mode, lhs, rhs, opts) record_mapping(mode, lhs, rhs, opts) end)
rawset(keymap, 'del', noop)

vim = new_proxy('vim')
for name, value in pairs({
  g = {}, env = {}, o = option_table(), wo = option_table(), bo = option_table(),
  b = option_table(), w = option_table(), t = option_table(),
  fn = fn, api = api, keymap = keymap, cmd = cmd, loop = loop, uv = loop,
  schedule = defer,
  defer_fn = defer,
  schedule_wrap = function(f) return f end,
  notify = noop, notify_once = noop, print = noop,
  inspect = function(value) return tostring(value) end,
  tbl_extend = function(behavior, ...) return tbl_extend_impl(false, behavior, ...) end,
  tbl_deep_extend = function(behavior, ...) return tbl_extend_impl(true, behavior, ...) end,
  deepcopy = deepcopy,
  list_extend = function(dst, src)
    if type(src) == 'table' then
      for _, value in ipairs(src) do dst[#dst + 1] = value end
    end
    return dst
  end,
  tbl_keys = function(tbl)
    local keys = {}
    for key in pairs(tbl) do keys[#keys + 1] = key end
    return keys
  end,
  tbl_values = function(tbl)
    local values = {}
    for _, value in pairs(tbl) do values[#values + 1] = value end
    return values
  end,
  tbl_contains = function(tbl, value)
    for _, v in pairs(tbl) do
      if v == value then return true end
    end
    return false
  end,
  tbl_isempty = function(tbl) return next(tbl) == nil end,
  tbl_map = function(f, tbl)
    local result = {}
    for key, value in pairs(tbl) do result[key] = f(value) end
    return result
  end,
  tbl_filter = function(f, tbl)
    local result = {}
    for _, value in pairs(tbl) do
      if f(value) then result[#result + 1] = value end
    end
    return result
  end,
  islist = is_list, tbl_islist = is_list,
  split = function(text, sep)
    local parts = {}
    local start = 1
    while true do
      local from, to = text:find(sep, start, true)
      if not from then break end
      parts[#parts + 1] = text:sub(start, from - 1)
      start = to + 1
    end
    parts[#parts + 1] = text:sub(start)
    return parts
  end,
  trim = function(text) return (text:gsub('^%s+', ''):gsub('%s+$', '')) end,
  startswith = function(text, prefix) return text:sub(1, #prefix) == prefix end,
  endswith = function(text, suffix) return suffix == '' or text:sub(-#suffix) == suffix end,
}) do
  rawset(vim, name, value)
end

---------------------------------------------------------------------------
-- No file, process or module access; Lua 5.1 names that Lua 5.4 dropped.

local function normalise_module(name)
  return (tostring(name):gsub('/', '.'))
end

require = function(name) return new_proxy(normalise_module(name)) end
package = {
  path = '', cpath = '', config = '/\n;\n?\n!\n-\n', preload = {},
  loaded = setmetatable({}, { __index = function(_, name) return new_proxy(normalise_module(name)) end }),
}
io = {
  open = function() return nil, 'no file access' end,
  popen = function() return nil, 'no process access' end,
  lines = function() error('no file access', 2) end,
  write = noop, read = noop,
  stdout = { write = noop, flush = noop }, stderr = { write = noop, flush = noop },
}
os = {
  time = os.time, date = os.date, clock = os.clock, difftime = os.difftime,
  getenv = function() return nil end,
  execute = noop, remove = noop, rename = noop,
  tmpname = function() return '/tmp/nvim' end,
  exit = function() error('os.exit was called', 2) end,
}
dofile = noop
loadfile = function() return nil, 'no file access' end
print = noop
debug = { traceback = debug.traceback, getinfo = getinfo }

unpack = table.unpack
table.getn = function(tbl) return #tbl end
table.maxn = function(tbl)
  local max = 0
  for key in pairs(tbl) do
    if type(key) == 'number' and key > max then max = key end
  end
  return max
end
loadstring = load
math.pow = function(a, b) return a ^ b end
setfenv = function(f) return f end
getfenv = function() return _G end

---------------------------------------------------------------------------
-- Run the config, then anything it scheduled.

-- Raises an error in whatever is running once the time limit has passed.
local function with_deadline(fn)
  local deadline = clock() + time_limit
  sethook(function()
    if clock() > deadline then
      sethook()
      error('stopped: the config ran for more than ' .. time_limit .. ' seconds', 2)
    end
  end, '', 10000)
  local ok, err = xpcall(fn, function(e) return tostring(e) end)
  sethook()
  return ok, err
end

local chunk, syntax_error = load(source, '=init.lua', 't')
if not chunk then
  rec.error = tostring(syntax_error)
else
  local ok, err = with_deadline(chunk)
  if not ok then rec.error = err end
end

-- Deferred functions may defer more; the list is walked until it is empty.
with_deadline(function()
  local index = 1
  while index <= #deferred and index <= 1000 do
    pcall(deferred[index])
    index = index + 1
  end
end)

if type(vim.g.mapleader) == 'string' then rec.leader = vim.g.mapleader end
if type(vim.g.maplocalleader) == 'string' then rec.localleader = vim.g.maplocalleader end

---------------------------------------------------------------------------
-- JSON

local ESCAPES = { ['"'] = '\\"', ['\\'] = '\\\\', ['\n'] = '\\n', ['\r'] = '\\r', ['\t'] = '\\t' }

local function encode(value)
  local kind = type(value)
  if kind == 'string' then
    return '"' .. value:gsub('[%c"\\]', function(ch)
      return ESCAPES[ch] or string.format('\\u%04x', ch:byte())
    end) .. '"'
  elseif kind == 'number' then
    return string.format('%d', value)
  elseif kind == 'boolean' then
    return tostring(value)
  elseif kind == 'table' then
    local parts = {}
    if getmetatable(value) == ARRAY then
      for i, item in ipairs(value) do parts[i] = encode(item) end
      return '[' .. table.concat(parts, ',') .. ']'
    end
    for key, item in pairs(value) do
      parts[#parts + 1] = encode(tostring(key)) .. ':' .. encode(item)
    end
    return '{' .. table.concat(parts, ',') .. '}'
  end
  return 'null'
end

return encode(rec)
