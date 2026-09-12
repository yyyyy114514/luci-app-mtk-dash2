local M = {}

local function is_array(value)
	if value.__sig == true then
		return false
	end
	local count = 0
	local max = 0
	for key in pairs(value) do
		if type(key) ~= "number" or key < 1 or key % 1 ~= 0 then
			return false
		end
		count = count + 1
		if key > max then
			max = key
		end
	end
	return count == max
end

local function escape_string(value)
	return '"' .. value:gsub('[%z\1-\31\\"]', function(char)
		local escaped = {
			["\b"] = "\\b",
			["\f"] = "\\f",
			["\n"] = "\\n",
			["\r"] = "\\r",
			["\t"] = "\\t",
			["\\"] = "\\\\",
			["\""] = "\\\""
		}
		return escaped[char] or string.format("\\u%04x", string.byte(char))
	end) .. '"'
end

local function encode_value(value, stack)
	local value_type = type(value)
	if value == nil then
		return "null"
	elseif value_type == "boolean" then
		return value and "true" or "false"
	elseif value_type == "number" then
		if value ~= value or value == math.huge or value == -math.huge then
			error("invalid number")
		end
		return tostring(value)
	elseif value_type == "string" then
		return escape_string(value)
	elseif value_type ~= "table" then
		error("unsupported type: " .. value_type)
	end

	if stack[value] then
		error("circular reference")
	end
	stack[value] = true
	local result = {}
	if is_array(value) then
		for index = 1, #value do
			result[#result + 1] = encode_value(value[index], stack)
		end
		stack[value] = nil
		return "[" .. table.concat(result, ",") .. "]"
	end

	for key, item in pairs(value) do
		if key ~= "__sig" or item ~= true then
			local k = type(key) == "number" and tostring(key) or key
			if type(k) ~= "string" then
				error("object keys must be strings")
			end
			result[#result + 1] = escape_string(k) .. ":" .. encode_value(item, stack)
		end
	end
	table.sort(result)
	stack[value] = nil
	return "{" .. table.concat(result, ",") .. "}"
end

function M.encode(value)
	return encode_value(value, {})
end

local function decode_error(source, position, message)
	error("JSON error at " .. position .. ": " .. message .. " near " .. source:sub(position, position + 20), 0)
end

local function decode_string(source, position)
	local result = {}
	position = position + 1
	while position <= #source do
		local char = source:sub(position, position)
		if char == '"' then
			return table.concat(result), position + 1
		elseif char == "\\" then
			local escape = source:sub(position + 1, position + 1)
			local escaped = {
				["\""] = "\"",
				["\\"] = "\\",
				["/"] = "/",
				b = "\b",
				f = "\f",
				n = "\n",
				r = "\r",
				t = "\t"
			}
			if escaped[escape] then
				result[#result + 1] = escaped[escape]
				position = position + 2
			elseif escape == "u" then
				local hex = source:sub(position + 2, position + 5)
				if not hex:match("^%x%x%x%x$") then
					decode_error(source, position, "invalid unicode escape")
				end
				local code = tonumber(hex, 16)
				if code < 128 then
					result[#result + 1] = string.char(code)
				elseif code < 2048 then
					result[#result + 1] = string.char(192 + math.floor(code / 64), 128 + code % 64)
				else
					result[#result + 1] = string.char(224 + math.floor(code / 4096), 128 + math.floor(code / 64) % 64, 128 + code % 64)
				end
				position = position + 6
			else
				decode_error(source, position, "invalid escape")
			end
		elseif string.byte(char) < 32 then
			decode_error(source, position, "control character in string")
		else
			result[#result + 1] = char
			position = position + 1
		end
	end
	decode_error(source, position, "unterminated string")
end

local function skip_space(source, position)
	while position <= #source and source:sub(position, position):match("%s") do
		position = position + 1
	end
	return position
end

local parse_value

local function parse_array(source, position)
	local result = {}
	position = skip_space(source, position + 1)
	if source:sub(position, position) == "]" then
		return result, position + 1
	end
	while true do
		local item
		item, position = parse_value(source, position)
		result[#result + 1] = item
		position = skip_space(source, position)
		local delimiter = source:sub(position, position)
		if delimiter == "]" then
			return result, position + 1
		elseif delimiter ~= "," then
			decode_error(source, position, "expected comma or closing bracket")
		end
		position = skip_space(source, position + 1)
	end
end

local function parse_object(source, position)
	local result = {}
	position = skip_space(source, position + 1)
	if source:sub(position, position) == "}" then
		return result, position + 1
	end
	while true do
		if source:sub(position, position) ~= '"' then
			decode_error(source, position, "expected object key")
		end
		local key
		key, position = decode_string(source, position)
		position = skip_space(source, position)
		if source:sub(position, position) ~= ":" then
			decode_error(source, position, "expected colon")
		end
		local item
		item, position = parse_value(source, skip_space(source, position + 1))
		result[key] = item
		position = skip_space(source, position)
		local delimiter = source:sub(position, position)
		if delimiter == "}" then
			return result, position + 1
		elseif delimiter ~= "," then
			decode_error(source, position, "expected comma or closing brace")
		end
		position = skip_space(source, position + 1)
	end
end

parse_value = function(source, position)
	local char = source:sub(position, position)
	if char == '"' then
		return decode_string(source, position)
	elseif char == "{" then
		return parse_object(source, position)
	elseif char == "[" then
		return parse_array(source, position)
	elseif source:sub(position, position + 3) == "true" then
		return true, position + 4
	elseif source:sub(position, position + 4) == "false" then
		return false, position + 5
	elseif source:sub(position, position + 3) == "null" then
		return nil, position + 4
	end
	local number = source:match("^-?%d+%.?%d*[eE]?[+-]?%d*", position)
	if number and number ~= "" and number ~= "-" then
		return tonumber(number), position + #number
	end
	decode_error(source, position, "unexpected value")
end

function M.decode(source)
	if type(source) ~= "string" then
		error("JSON input must be a string", 2)
	end
	local value, position = parse_value(source, skip_space(source, 1))
	position = skip_space(source, position)
	if position <= #source then
		decode_error(source, position, "trailing data")
	end
	return value
end

return M
