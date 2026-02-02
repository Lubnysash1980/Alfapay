import sys, os
sys.path.append(os.path.dirname(__file__))
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))
sys.path.append(os.path.join(os.path.dirname(__file__), "frontend"))
from backend.license_manager import LicenseManager
from frontend.menu_bar import menu_loop

if __name__ == "__main__":
    license_mgr = LicenseManager()
    menu_loop(license_mgr)
