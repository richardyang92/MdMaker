#!/usr/bin/env bash
# =============================================================================
# MdMaker 一键启动/停止脚本
#
# 用法:
#   ./dev.sh            启动前端 + 后端（默认命令）
#   ./dev.sh start      同上
#   ./dev.sh stop       一次性关闭所有服务
#   ./dev.sh restart    重启所有服务
#   ./dev.sh status     查看运行状态
#   ./dev.sh logs       实时查看日志（Ctrl+C 退出查看，不影响服务）
#
# 说明:
#   - 首次运行会自动安装缺失的依赖（poetry install / npm install）
#   - 日志保存在 .dev/logs/，PID 保存在 .dev/*.pid（均已加入 .gitignore）
#   - 前端端口 5173，后端端口 8000（如需修改请改下方常量）
# =============================================================================
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
RUN_DIR="$ROOT_DIR/.dev"
LOG_DIR="$RUN_DIR/logs"

BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

BACKEND_PORT=8000
FRONTEND_PORT=5173
BACKEND_URL="http://localhost:${BACKEND_PORT}"
FRONTEND_URL="http://localhost:${FRONTEND_PORT}"

# -----------------------------------------------------------------------------
# 基础工具函数
# -----------------------------------------------------------------------------
log_info()  { echo "[dev] $*"; }
log_ok()    { echo "[dev] ✅ $*"; }
log_warn()  { echo "[dev] ⚠️  $*" >&2; }
log_error() { echo "[dev] ❌ $*" >&2; }

# 端口是否被监听
port_in_use() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

# 进程是否存活
pid_alive() {
  [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null
}

# 端口上的监听进程 PID 列表
listener_pids() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null || true
}

# 进程是否属于本项目（工作目录或命令行包含项目路径）
owned_by_project() {
  local pid="$1"
  lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | grep -Fq "$ROOT_DIR" \
    || ps -o command= -p "$pid" 2>/dev/null | grep -Fq "$ROOT_DIR"
}

read_pid() {
  [ -f "$1" ] && cat "$1" 2>/dev/null || true
}

usage() {
  sed -n '2,14p' "${BASH_SOURCE[0]}"
}

# -----------------------------------------------------------------------------
# 依赖检查（缺失时自动安装）
# -----------------------------------------------------------------------------
check_dependencies() {
  if ! command -v poetry >/dev/null 2>&1; then
    log_error "未找到 poetry，请先安装: https://python-poetry.org/docs/"
    return 1
  fi
  if ! command -v npm >/dev/null 2>&1; then
    log_error "未找到 npm，请先安装 Node.js 18+: https://nodejs.org/"
    return 1
  fi
  if [ ! -d "$BACKEND_DIR/.venv" ]; then
    log_info "后端依赖未安装，正在执行 poetry install（首次运行需几分钟）..."
    (cd "$BACKEND_DIR" && poetry install) || { log_error "poetry install 失败"; return 1; }
  fi
  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    log_info "前端依赖未安装，正在执行 npm install（首次运行需几分钟）..."
    (cd "$FRONTEND_DIR" && npm install) || { log_error "npm install 失败"; return 1; }
  fi
}

# -----------------------------------------------------------------------------
# 启动
# -----------------------------------------------------------------------------
start_backend() {
  ( cd "$BACKEND_DIR" \
      && exec nohup poetry run uvicorn app.main:app \
          --host 127.0.0.1 --port "$BACKEND_PORT" --reload ) >>"$BACKEND_LOG" 2>&1 &
  echo $! > "$BACKEND_PID_FILE"
}

start_frontend() {
  ( cd "$FRONTEND_DIR" \
      && exec nohup npm run dev ) >>"$FRONTEND_LOG" 2>&1 &
  echo $! > "$FRONTEND_PID_FILE"
}

# 等待 HTTP 服务就绪；失败时输出日志尾部
wait_for_http() {
  local name="$1" url="$2" pid="$3" logfile="$4" timeout="${5:-60}"
  local i=0
  while [ "$i" -lt "$timeout" ]; do
    if ! pid_alive "$pid"; then
      log_error "$name 启动失败（进程已退出），最近日志:"
      tail -n 20 "$logfile" >&2 || true
      return 1
    fi
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  log_error "$name 启动超时（${timeout}s 未就绪），最近日志:"
  tail -n 20 "$logfile" >&2 || true
  return 1
}

do_start() {
  mkdir -p "$RUN_DIR" "$LOG_DIR"

  # 已在运行？
  local backend_running=0 frontend_running=0
  local bpid fpid
  bpid="$(read_pid "$BACKEND_PID_FILE")"
  fpid="$(read_pid "$FRONTEND_PID_FILE")"
  if [ -n "$bpid" ] && pid_alive "$bpid" && port_in_use "$BACKEND_PORT"; then
    backend_running=1
  fi
  if [ -n "$fpid" ] && pid_alive "$fpid" && port_in_use "$FRONTEND_PORT"; then
    frontend_running=1
  fi
  if [ "$backend_running" = 1 ] || [ "$frontend_running" = 1 ]; then
    log_warn "服务已在运行中。如需重启请执行: ./dev.sh restart"
    do_status
    return 1
  fi

  # 端口被其他进程占用？
  if port_in_use "$BACKEND_PORT" || port_in_use "$FRONTEND_PORT"; then
    log_error "端口被占用。请先执行 ./dev.sh stop 清理残留进程，或修改脚本中的端口常量"
    return 1
  fi

  check_dependencies || return 1

  log_info "启动后端 (端口 $BACKEND_PORT) ..."
  start_backend
  log_info "启动前端 (端口 $FRONTEND_PORT) ..."
  start_frontend

  local ok=1
  wait_for_http "后端" "$BACKEND_URL/health" "$(read_pid "$BACKEND_PID_FILE")" "$BACKEND_LOG" 90 || ok=0
  if [ "$ok" = 1 ]; then
    wait_for_http "前端" "$FRONTEND_URL/" "$(read_pid "$FRONTEND_PID_FILE")" "$FRONTEND_LOG" 60 || ok=0
  fi

  if [ "$ok" != 1 ]; then
    log_error "启动失败，正在清理..."
    do_stop >/dev/null 2>&1 || true
    return 1
  fi

  echo
  log_ok "全部服务已启动:"
  echo "   前端:  $FRONTEND_URL"
  echo "   后端:  $BACKEND_URL  (API 文档: $BACKEND_URL/docs)"
  echo "   日志:  $LOG_DIR/"
  echo
  echo "   关闭: ./dev.sh stop   状态: ./dev.sh status   日志: ./dev.sh logs"
}

# -----------------------------------------------------------------------------
# 停止
# -----------------------------------------------------------------------------
stop_service() {
  local name="$1" pidfile="$2" port="$3"
  local pid
  pid="$(read_pid "$pidfile")"

  if [ -n "$pid" ] && pid_alive "$pid"; then
    log_info "关闭 $name (PID $pid) ..."
    kill "$pid" 2>/dev/null || true
  fi
  rm -f "$pidfile"

  # 等待端口释放
  local i=0
  while port_in_use "$port" && [ "$i" -lt 25 ]; do
    i=$((i + 1))
    sleep 0.2
  done

  # 兜底：清理本项目残留的监听进程（如 uvicorn reload worker / vite 子进程）
  if port_in_use "$port"; then
    local lp
    for lp in $(listener_pids "$port"); do
      if [ -n "$lp" ] && owned_by_project "$lp"; then
        log_warn "$name 端口 $port 仍有残留进程 (PID $lp)，强制结束"
        kill "$lp" 2>/dev/null || true
      else
        log_warn "$name 端口 $port 被非本项目进程 (PID $lp) 占用，已跳过"
      fi
    done
    sleep 0.3
  fi
}

do_stop() {
  if [ ! -f "$BACKEND_PID_FILE" ] && [ ! -f "$FRONTEND_PID_FILE" ] \
    && ! port_in_use "$BACKEND_PORT" && ! port_in_use "$FRONTEND_PORT"; then
    log_info "当前没有正在运行的服务。"
    return 0
  fi

  stop_service "后端" "$BACKEND_PID_FILE" "$BACKEND_PORT"
  stop_service "前端" "$FRONTEND_PID_FILE" "$FRONTEND_PORT"

  if port_in_use "$BACKEND_PORT" || port_in_use "$FRONTEND_PORT"; then
    log_error "部分端口未能释放，请手动检查: lsof -nP -iTCP:$BACKEND_PORT -iTCP:$FRONTEND_PORT -sTCP:LISTEN"
    return 1
  fi
  log_ok "所有服务已关闭。"
}

# -----------------------------------------------------------------------------
# 状态 / 日志
# -----------------------------------------------------------------------------
service_status() {
  local name="$1" pidfile="$2" port="$3" url="$4"
  local pid state health
  pid="$(read_pid "$pidfile")"
  if [ -n "$pid" ] && pid_alive "$pid" && port_in_use "$port"; then
    state="运行中 (PID $pid)"
  elif port_in_use "$port"; then
    state="端口 $port 被占用（非本脚本管理）"
  else
    state="未运行"
  fi
  if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
    health="✅ 响应正常"
  else
    health="—"
  fi
  echo "  $name: $state  $health"
}

do_status() {
  echo "MdMaker 服务状态:"
  service_status "后端 (:$BACKEND_PORT)" "$BACKEND_PID_FILE" "$BACKEND_PORT" "$BACKEND_URL/health"
  service_status "前端 (:$FRONTEND_PORT)" "$FRONTEND_PID_FILE" "$FRONTEND_PORT" "$FRONTEND_URL/"
  echo
  echo "  关闭: ./dev.sh stop   日志: ./dev.sh logs"
}

do_logs() {
  local files=()
  [ -f "$BACKEND_LOG" ] && files+=("$BACKEND_LOG")
  [ -f "$FRONTEND_LOG" ] && files+=("$FRONTEND_LOG")
  if [ ${#files[@]} -eq 0 ]; then
    log_info "暂无日志文件（服务可能尚未启动过）"
    return 0
  fi
  log_info "实时日志（Ctrl+C 退出查看，不影响服务）..."
  tail -n 30 -f "${files[@]}"
}

# -----------------------------------------------------------------------------
# 命令分发
# -----------------------------------------------------------------------------
case "${1:-start}" in
  start)   do_start ;;
  stop)    do_stop ;;
  restart) do_stop; do_start ;;
  status)  do_status ;;
  logs)    do_logs ;;
  -h|--help|help) usage ;;
  *)
    usage
    log_error "未知命令: $1"
    exit 1
    ;;
esac
