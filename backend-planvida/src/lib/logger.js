// =========================================================
// Logger estruturado em JSON (1 linha por evento)
// Facilita busca/parse no Render logs ou Datadog.
// =========================================================
const isProd = process.env.NODE_ENV === 'production';

function emit(level, msg, meta){
  if(isProd){
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      msg,
      ...(meta || {}),
    });
    if(level === 'error') console.error(line);
    else if(level === 'warn') console.warn(line);
    else console.log(line);
  } else {
    const tag = level === 'error' ? '\x1b[31m[err]\x1b[0m' :
                level === 'warn'  ? '\x1b[33m[warn]\x1b[0m' :
                '\x1b[36m[info]\x1b[0m';
    if(meta) console.log(tag, msg, meta);
    else     console.log(tag, msg);
  }
}

export const log = {
  info:  (msg, meta) => emit('info',  msg, meta),
  warn:  (msg, meta) => emit('warn',  msg, meta),
  error: (msg, meta) => emit('error', msg, meta),
};

export default log;
