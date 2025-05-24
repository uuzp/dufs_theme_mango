#!/bin/bash

# 🥭 Mango 文件管理器启动脚本
# 适用于 Linux/macOS
# 自动下载dufs并启动文件服务器

echo "================================="
echo "   🥭 Mango 文件管理器启动"
echo "================================="
echo

# 检测系统架构和操作系统
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$ARCH" in
    x86_64)
        ARCH="x86_64"
        ;;
    aarch64|arm64)
        ARCH="aarch64"
        ;;
    *)
        echo "警告: 不支持的架构 $ARCH，将尝试 x86_64"
        ARCH="x86_64"
        ;;
esac

# 设置下载URL
if [ "$OS" = "darwin" ]; then
    # macOS
    DOWNLOAD_URL="https://github.com/sigoden/dufs/releases/latest/download/dufs-v0.42.0-$ARCH-apple-darwin.tar.gz"
    DUFS_BINARY="dufs"
else
    # Linux
    DOWNLOAD_URL="https://github.com/sigoden/dufs/releases/latest/download/dufs-v0.42.0-$ARCH-unknown-linux-musl.tar.gz"
    DUFS_BINARY="dufs"
fi

# 检查dufs是否已存在
if command -v dufs >/dev/null 2>&1; then
    echo "✓ 找到系统安装的dufs"
    DUFS_CMD="dufs"
elif [ -f "./dufs" ]; then
    echo "✓ 找到本地dufs可执行文件"
    DUFS_CMD="./dufs"
else
    echo "未找到dufs，正在自动下载..."
    echo "系统: $OS"
    echo "架构: $ARCH"
    echo "下载地址: $DOWNLOAD_URL"
    echo
    
    # 检查curl或wget
    if command -v curl >/dev/null 2>&1; then
        echo "使用curl下载..."
        curl -L -o dufs.tar.gz "$DOWNLOAD_URL"
    elif command -v wget >/dev/null 2>&1; then
        echo "使用wget下载..."
        wget -O dufs.tar.gz "$DOWNLOAD_URL"
    else
        echo "错误: 未找到curl或wget下载工具"
        echo "请手动安装dufs："
        echo "  cargo install dufs"
        echo "  或从 https://github.com/sigoden/dufs/releases 下载"
        exit 1
    fi
    
    if [ $? -eq 0 ] && [ -f dufs.tar.gz ]; then
        echo "✓ 下载完成，正在解压..."
        tar -xzf dufs.tar.gz
        
        if [ -f "$DUFS_BINARY" ]; then
            chmod +x "$DUFS_BINARY"
            rm dufs.tar.gz
            echo "✓ dufs已准备就绪"
            DUFS_CMD="./dufs"
        else
            echo "错误: 解压失败，请检查下载的文件"
            exit 1
        fi
    else
        echo "错误: 下载失败"
        echo "请检查网络连接或手动下载dufs"
        exit 1
    fi
fi

# 设置dufs命令
DUFS_CMD=${DUFS_CMD:-dufs}

# 创建data目录用于演示
mkdir -p data
echo "🎉 欢迎使用 🥭 Mango 文件管理器！" > data/welcome.txt

# 检查配置文件
if [ ! -f "dufs.yaml" ]; then
    echo "警告: 未找到dufs.yaml配置文件"
    echo "将使用默认参数启动"
    USE_CONFIG=false
else
    echo "✓ 找到dufs.yaml配置文件"
    USE_CONFIG=true
fi

echo
echo "启动配置："
echo "- 服务地址: http://localhost:5000"
echo "- 主题目录: html/"
echo "- 数据目录: data/"
echo "- 允许所有操作（上传、删除、搜索等）"
echo

# 启动dufs服务器
echo "正在启动 🥭 Mango 文件管理器..."
echo

if [ "$USE_CONFIG" = true ]; then
    $DUFS_CMD --config dufs.yaml
else
    # 使用默认参数
    $DUFS_CMD --bind 0.0.0.0:5000 --render-index --render-spa --allow-upload --allow-delete --allow-search --theme-folder html data
fi
