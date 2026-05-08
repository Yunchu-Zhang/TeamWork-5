import importlib.metadata
from packaging import version

# 你要求的依赖清单
REQUIREMENTS = {
    "gradio": "5.29.0",
    "litserve": "0.2.8",
    "opencv-python-headless": "4.10.0.84",
    "sam-2": None,  # Git 安装，无法直接校验版本
    "supervision": "0.23.0",
    "transformers": "4.44.2",
    "torch": "2.3.1",
    "torchvision": "0.18.1",
}

print("=" * 60)
print("环境依赖检查结果")
print("=" * 60)

all_ok = True

for pkg, req_ver in REQUIREMENTS.items():
    try:
        # 获取已安装版本
        installed_ver = importlib.metadata.version(pkg)

        if req_ver is None:
            print(f"✅ {pkg}: 已安装 (Git 来源)")
            continue

        # 版本对比
        if version.parse(installed_ver) >= version.parse(req_ver):
            print(f"✅ {pkg}: {installed_ver} (满足 >= {req_ver})")
        else:
            print(f"❌ {pkg}: {installed_ver} (需要 >= {req_ver})")
            all_ok = False

    except importlib.metadata.PackageNotFoundError:
        print(f"⚠️ {pkg}: 未安装")
        all_ok = False

print("=" * 60)
if all_ok:
    print("✅ 所有依赖版本都满足要求！")
else:
    print("❌ 部分依赖不满足，请升级或安装对应包。")
print("=" * 60)