from datetime import datetime
from pathlib import Path
import shutil

CURRENT_RUN_DIR = Path("outputs/current_run")
RUNS_DIR = Path("outputs/runs")


def archive_current_run():
    if not CURRENT_RUN_DIR.exists():
        print("❌ outputs/current_run folder does not exist.")
        return

    md_files = list(CURRENT_RUN_DIR.glob("*.md"))

    if not md_files:
        print("❌ No .md files found in outputs/current_run. Nothing to archive.")
        return

    RUNS_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y_%m_%d_%H%M%S")
    archive_dir = RUNS_DIR / f"run_{timestamp}"
    archive_dir.mkdir(parents=True, exist_ok=False)

    for file in md_files:
        shutil.copy2(file, archive_dir / file.name)

    print("✅ Current run archived successfully.")
    print(f"📁 Saved to: {archive_dir}")
    print(f"📄 Files copied: {len(md_files)}")


if __name__ == "__main__":
    archive_current_run()