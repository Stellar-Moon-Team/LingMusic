@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo 首次运行，正在安装依赖...
  call npm install
)
echo 正在构建并启动 OST 展示页面（关闭此窗口即停止）...
call npm start
