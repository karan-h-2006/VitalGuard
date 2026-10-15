import socket

redis_url = 'redis://localhost:6379'
lua = "if redis.call('set', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2]) then return 1 elseif redis.call('get', KEYS[1]) == ARGV[1] then redis.call('pexpire', KEYS[1], ARGV[2]) return 1 else return 0 end"

def eval_lease(key: str, val: str, ttl: int = 5000) -> bool:
    with socket.create_connection(('localhost', 6379), timeout=2.0) as s:
        # EVAL script 1 key val ttl
        cmd = (
            f"*6\r\n$4\r\nEVAL\r\n${len(lua)}\r\n{lua}\r\n"
            f"$1\r\n1\r\n${len(key)}\r\n{key}\r\n"
            f"${len(val)}\r\n{val}\r\n${len(str(ttl))}\r\n{ttl}\r\n"
        )
        s.sendall(cmd.encode('utf-8'))
        res = s.recv(512)
        return b':1' in res

print('manager1 acquire:', eval_lease('test:lease:foo', 'm1', ttl=2000))
print('manager1 renew:', eval_lease('test:lease:foo', 'm1', ttl=2000))
print('manager2 acquire (expect False):', eval_lease('test:lease:foo', 'm2', ttl=2000))
import time
time.sleep(2.5)
print('manager2 acquire after expiry (expect True):', eval_lease('test:lease:foo', 'm2', ttl=2000))
