@echo off
chcp 65001 >nul
title 🥭 Mango 文件管理器

REM 处理命令行参数
set LOCK_PASSWORD_ARG=
if not "%~1"=="" (
    if /i "%~1"=="--lock-password" (
        if not "%~2"=="" (
            set LOCK_PASSWORD_ARG=-LockPassword "%~2"
            echo 🔐 设置锁定密码: %~2
        ) else (
            echo ❌ 错误: --lock-password 需要指定密码值
            echo 用法: start.bat --lock-password 你的密码
            pause
            exit /b 1
        )
    ) else if /i "%~1"=="--help" (
        echo.
        echo 🥭 Mango 文件管理器启动脚本
        echo.
        echo 用法:
        echo   start.bat                           - 使用默认密码 mango2025 启动
        echo   start.bat --lock-password 密码      - 设置自定义锁定密码
        echo   start.bat --help                    - 显示此帮助信息
        echo.
        echo 示例:
        echo   start.bat --lock-password 123456
        echo.
        pause
        exit /b 0
    ) else (
        echo ❌ 未知参数: %~1
        echo 使用 start.bat --help 查看帮助
        pause
        exit /b 1
    )
)

echo.
echo 🚀 Mango 文件管理器启动脚本
echo.

REM 检查并创建 data 目录
echo 📁 检查 data 目录...
if not exist "data" (
    echo    创建 data 目录...
    mkdir data
    echo    ✅ 已创建 data 目录
      REM 创建欢迎文件
    echo 🎉 欢迎使用 🥭 Mango 文件管理器！> "data\欢迎使用.txt"
    echo.>> "data\欢迎使用.txt"
    echo 这是一个现代化的 Web 文件管理器。>> "data\欢迎使用.txt"
    echo.>> "data\欢迎使用.txt"
    echo 功能特点：>> "data\欢迎使用.txt"
    echo - 拖拽上传文件>> "data\欢迎使用.txt"
    echo - 快速搜索文件>> "data\欢迎使用.txt"
    echo - 原生操作体验>> "data\欢迎使用.txt"
    echo - 响应式设计>> "data\欢迎使用.txt"
    echo.>> "data\欢迎使用.txt"
    echo 访问地址: http://127.0.0.1:5000>> "data\欢迎使用.txt"
) else (
    echo    ✅ data 目录已存在
)

REM 检查 PowerShell 是否可用
echo 🔍 检查 PowerShell 可用性...
powershell -Command "Get-Host" >nul 2>&1
if errorlevel 1 (
    echo    ❌ PowerShell 不可用，尝试直接运行 dufs.exe
    goto :DIRECT_RUN
) else (
    echo    ✅ PowerShell 可用，调用 PowerShell 脚本
)

echo.
echo 🚀 正在调用 PowerShell 启动脚本...
echo    文件: start.ps1
echo.

REM 调用 PowerShell 脚本，传递密码参数
powershell -ExecutionPolicy Bypass -File "start.ps1" %LOCK_PASSWORD_ARG%

REM 如果 PowerShell 脚本执行成功，直接退出
if not errorlevel 1 (
    exit /b 0
)

echo.
echo ⚠️  PowerShell 脚本执行失败，尝试直接运行...
echo.

:DIRECT_RUN
REM 检查 dufs.exe
echo 🔍 检查 dufs 可执行文件...
if not exist "dufs.exe" (
    echo    ❌ dufs.exe 不存在
    echo.
    echo 📥 请手动下载 dufs.exe 文件：
    echo    1. 访问: https://github.com/sigoden/dufs/releases/latest
    echo    2. 下载适合您系统的版本（通常是 dufs-v*-x86_64-pc-windows-msvc.zip）
    echo    3. 解压并将 dufs.exe 放到当前目录
    echo.
    echo 💡 提示：建议安装 PowerShell 以获得自动下载功能
    echo.
    pause
    exit /b 1
) else (
    echo    ✅ dufs.exe 已存在
)

REM 检查配置文件
echo ⚙️ 检查配置文件...
if not exist "dufs.yaml" (
    echo    ⚠️  配置文件不存在，使用默认配置
    set CONFIG_ARGS=--bind 0.0.0.0 --port 5000 --render-index --render-spa --allow-upload --allow-delete --allow-search --theme-folder html data
) else (
    echo    ✅ 配置文件存在
    set CONFIG_ARGS=--config dufs.yaml
)

echo.
echo 🎯 启动 🥭 Mango 文件管理器...
echo.

REM 启动 dufs
dufs.exe %CONFIG_ARGS%
