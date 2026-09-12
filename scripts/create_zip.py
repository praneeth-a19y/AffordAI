import os
import zipfile

def create_code_zip(output_filename="code.zip"):
    exclude_dirs = {"node_modules", ".git", "dist", ".system_generated"}
    exclude_files = {"code.zip"}

    with zipfile.ZipFile(output_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk("."):
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            for file in files:
                if file in exclude_files:
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, ".")
                zipf.write(file_path, arcname)

    print(f"Created {output_filename} successfully.")

if __name__ == "__main__":
    create_code_zip()
