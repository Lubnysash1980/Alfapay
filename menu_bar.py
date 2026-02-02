def display_menu():
    print("=== CYBRA-PARLIAMENT FRONTEND MENU ===")
    print("1. Start Backend Release")
    print("2. Issue License Token")
    print("3. Check License Token")
    print("4. Exit")

def menu_loop(license_mgr):
    while True:
        display_menu()
        choice = input("Choose option: ")
        if choice=="1":
            from backend.run_backend import run_backend_demo
            run_backend_demo()
        elif choice=="2":
            buyer = input("Enter buyer ID: ")
            token = license_mgr.issue_license(buyer, 60*60*24)
            print("LICENSE TOKEN:", token)
        elif choice=="3":
            token = input("Enter token: ")
            valid = license_mgr.verify_license(token)
            print("Valid:", valid)
        elif choice=="4":
            break
        else:
            print("Invalid choice")
