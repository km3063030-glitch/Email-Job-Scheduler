import { redis } from '../lib/redis.js';

const RESERVE_RATE_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local retryAt = tonumber(ARGV[3])

local current = tonumber(redis.call('GET', key) or '0')

if current >= limit then
  return {0, retryAt}
end

local next = redis.call('INCR', key)
redis.call('EXPIRE', key, ttl)

return {1, next}
`;

const RESERVE_DELAY_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local delay = tonumber(ARGV[2])

local previous = tonumber(redis.call('GET', key) or '0')

local sendAt = math.max(now, previous)
local nextAvailable = sendAt + delay

redis.call(
  'SET',
  key,
  nextAvailable,
  'PX',
  math.max(delay * 3, 60000)
)

return sendAt
`;

export async function reserveHourlySlot(senderId: string, limit: number) {
  const hourStart = Math.floor(Date.now() / 3600000) * 3600000;
  const nextHour = hourStart + 3600000;

  const key = `email-rate:${senderId}:${hourStart}`;

  const result = await redis.eval(
    RESERVE_RATE_SCRIPT,
    1,
    key,
    limit,
    7200,
    nextHour,
  ) as [number, number];

  if (Number(result[0]) === 1) {
    return {
      allowed: true,
      retryAt: 0,
    };
  }

  return {
    allowed: false,
    retryAt: nextHour,
  };
}

export async function reserveSendTime(
  senderId: string,
  minDelayMs: number,
) {
  const key = `email-delay:${senderId}`;

  const assigned = await redis.eval(
    RESERVE_DELAY_SCRIPT,
    1,
    key,
    Date.now(),
    minDelayMs,
  ) as number;

  return Number(assigned);
}

export async function getRateLimitWindow(
  senderId: string,
  limit: number,
) {
  const hourStart = Math.floor(Date.now() / 3600000) * 3600000;
  const key = `email-rate:${senderId}:${hourStart}`;

  const count = Number(await redis.get(key) || 0);

  return {
    count,
    limit,
    remaining: Math.max(0, limit - count),
    resetsAt: hourStart + 3600000,
  };
}