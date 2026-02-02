from hash_memory import HashMemory
from ai_director import ShootingModel3D, ai_director_control
from cybra_parliament import CybraParliament
from license_manager import LicenseManager
import multiprocessing, hashlib

def run_backend_demo():
    # Ініціалізація
    hash_mem = HashMemory()
    parliament = CybraParliament()
    model = ShootingModel3D({'geometry':'geom_001','light':'daylight','color':'warm','camera':'cam_01'})
    license_mgr = LicenseManager()
    buyer_token = license_mgr.issue_license("client_123", 60*60*24)
    print("LICENSE TOKEN:", buyer_token)

    timestamps = [34678.7789996, 34679.1234567, 34680.9876543]
    frames = []
    for i, ts in enumerate(timestamps):
        frame = {
            'geometry':'geom_001' if i != 1 else 'geom_002',
            'light':'daylight','color':'warm','camera':'cam_01',
            'timestamp': ts
        }
        frame['hash_segment'] = hash_mem.store(frame)
        frames.append(frame)

    if not license_mgr.verify_license(buyer_token):
        print("LICENSE INVALID")
        return

    # Мультипроцесінг
    pool = multiprocessing.Pool(processes=3)
    results = pool.starmap(ai_director_control, [(f, model) for f in frames])
    pool.close()
    pool.join()

    # CYBRA-PARLIAMENT рішення
    final_results = [parliament.debate(r) for r in results]
    for r in final_results:
        print(f"HASH_SEGMENT: {r['hash_segment']} | DECISION: {r['parliament_decision']} | STATUS: {r['status']}")
