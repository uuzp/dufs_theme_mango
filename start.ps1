# 🥭 Mango 文件管理器启动脚本 (PowerShell)
# 自动检测系统架构并下载对应的 dufs 可执行文件

param(
    [switch]$Force,  # 强制重新下载
    [switch]$Help    # 显示帮助
)

# 颜色输出函数
function Write-ColorText {
    param($Text, $Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

function Write-Success { param($Text) Write-ColorText $Text "Green" }
function Write-Error { param($Text) Write-ColorText $Text "Red" }
function Write-Warning { param($Text) Write-ColorText $Text "Yellow" }
function Write-Info { param($Text) Write-ColorText $Text "Cyan" }

# 显示帮助信息
if ($Help) {
    Write-Info "🥭 Mango 文件管理器启动脚本"
    Write-Host ""
    Write-Host "用法:"
    Write-Host "  .\start.ps1          - 启动文件管理器"
    Write-Host "  .\start.ps1 -Force   - 强制重新下载 dufs 可执行文件"
    Write-Host "  .\start.ps1 -Help    - 显示此帮助信息"
    Write-Host ""
    Write-Host "功能:"
    Write-Host "  - 自动检测系统架构"
    Write-Host "  - 自动下载对应的 dufs 可执行文件"
    Write-Host "  - 自动创建 data 目录"    
    Write-Host "  - 启动 🥭 Mango 文件管理器"
    exit 0
}

Write-Info "🚀 Mango 文件管理器启动脚本"
Write-Host ""

# 配置信息
$DUFS_VERSION = "v0.43.0"
$GITHUB_BASE_URL = "https://github.com/sigoden/dufs/releases/download/$DUFS_VERSION"
$DATA_DIR = "data"
$CONFIG_FILE = "dufs.yaml"

# 检测系统架构和平台
function Get-SystemInfo {
    $arch = $env:PROCESSOR_ARCHITECTURE
    $osInfo = Get-WmiObject -Class Win32_OperatingSystem
    
    # 确定架构
    $targetArch = switch ($arch) {
        "AMD64" { "x86_64" }
        "ARM64" { "aarch64" }
        "x86" { "i686" }
        default { "x86_64" }
    }
    
    # Windows 平台
    $platform = "pc-windows-msvc"
    $extension = "zip"
    $executable = "dufs.exe"
    
    return @{
        Architecture = $targetArch
        Platform = $platform
        Extension = $extension
        Executable = $executable
        FileName = "dufs-$DUFS_VERSION-$targetArch-$platform.$extension"
    }
}

# 下载并解压文件
function Download-Dufs {
    param($SystemInfo)
    
    $downloadUrl = "$GITHUB_BASE_URL/$($SystemInfo.FileName)"
    $downloadPath = ".\$($SystemInfo.FileName)"
    
    Write-Info "📥 下载 dufs 可执行文件..."
    Write-Host "   架构: $($SystemInfo.Architecture)"
    Write-Host "   平台: $($SystemInfo.Platform)"
    Write-Host "   文件: $($SystemInfo.FileName)"
    Write-Host "   URL: $downloadUrl"
    Write-Host ""
    
    try {
        # 下载文件
        Write-Info "正在下载..."
        Invoke-WebRequest -Uri $downloadUrl -OutFile $downloadPath -UseBasicParsing
        Write-Success "✅ 下载完成"
        
        # 解压文件
        Write-Info "正在解压..."
        if ($SystemInfo.Extension -eq "zip") {
            Expand-Archive -Path $downloadPath -DestinationPath "." -Force
        } else {
            # 对于 tar.gz 文件，需要额外处理
            Write-Warning "⚠️  需要手动解压 tar.gz 文件: $downloadPath"
        }
        
        # 清理下载的压缩包
        Remove-Item $downloadPath -Force
        Write-Success "✅ 解压完成，已清理临时文件"
        
        return $true
    } catch {
        Write-Error "❌ 下载失败: $($_.Exception.Message)"
        return $false
    }
}

# 检查并创建 data 目录
function Ensure-DataDirectory {
    Write-Info "📁 检查 data 目录..."
    
    if (-not (Test-Path $DATA_DIR)) {
        Write-Warning "data 目录不存在，正在创建..."
        New-Item -ItemType Directory -Path $DATA_DIR -Force | Out-Null
        Write-Success "✅ 已创建 data 目录"
          # 创建示例文件
        $welcomeFile = Join-Path $DATA_DIR "欢迎使用.txt"
        $welcomeContent = @"
🎉 欢迎使用 🥭 Mango 文件管理器！

这是一个现代化的 Web 文件管理器，具有以下特性：

✨ 功能特点：
- 🖱️ 原生文件操作体验（单击、右键菜单、拖拽）
- 📤 拖拽上传文件
- 🔍 快速搜索文件
- 📋 一键复制文件哈希值
- 📱 响应式设计，支持移动设备
- 🎨 现代化的用户界面

🚀 开始使用：
1. 将文件拖拽到浏览器窗口即可上传
2. 单击文件下载，单击文件夹进入
3. 右键点击文件查看更多操作
4. 使用搜索框快速查找文件

📁 当前数据目录: ./data
🌐 访问地址: http://127.0.0.1:5000

享受你的文件管理体验！
"@
        Set-Content -Path $welcomeFile -Value $welcomeContent -Encoding UTF8
        Write-Success "✅ 已创建欢迎文件"
    } else {
        Write-Success "✅ data 目录已存在"
    }
}

# 检查 dufs 可执行文件
function Check-DufsExecutable {
    $systemInfo = Get-SystemInfo
    $exePath = ".\$($systemInfo.Executable)"
    
    Write-Info "🔍 检查 dufs 可执行文件..."
    
    if ($Force -or -not (Test-Path $exePath)) {
        if ($Force) {
            Write-Warning "强制重新下载模式"
        } else {
            Write-Warning "dufs.exe 不存在"
        }
        
        $success = Download-Dufs $systemInfo
        if (-not $success) {
            Write-Error "❌ 无法下载 dufs 可执行文件"
            exit 1
        }
    } else {
        Write-Success "✅ dufs.exe 已存在"
    }
    
    return $exePath
}

# 检查配置文件
function Check-ConfigFile {
    Write-Info "⚙️ 检查配置文件..."
    
    if (-not (Test-Path $CONFIG_FILE)) {
        Write-Warning "配置文件不存在，请确保 dufs.yaml 存在"
        Write-Info "将使用默认配置启动..."
        return $false
    } else {
        Write-Success "✅ 配置文件存在"
        return $true
    }
}

# 启动 dufs
function Start-Dufs {
    param($ExePath, $HasConfig)
    
    Write-Info "🎯 启动 🥭 Mango 文件管理器..."
    Write-Host ""
    
    if ($HasConfig) {
        Write-Info "使用配置文件启动: $CONFIG_FILE"
        $arguments = "--config", $CONFIG_FILE
    } else {
        Write-Info "使用默认配置启动"
        $arguments = "--bind", "0.0.0.0", "--port", "5000", "--allow-all", ".\data"
    }
    
    Write-Host ""
    
    # 直接启动 dufs
    & $ExePath @arguments
}

# 主执行流程
# 检查并创建 data 目录
Ensure-DataDirectory

# 检查并下载 dufs 可执行文件
$exePath = Check-DufsExecutable

# 检查配置文件
$hasConfig = Check-ConfigFile

Write-Host ""
Write-Success "🎉 准备完成，正在启动..."
Write-Host ""

# 启动服务
Start-Dufs $exePath $hasConfig
