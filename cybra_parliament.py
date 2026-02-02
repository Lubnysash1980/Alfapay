import hashlib

class CybraParliament:
    def __init__(self):
        self.decision_log = []

    def debate(self, frame_result: dict):
        frame_result["parliament_decision"] = "HOLD" if frame_result["status"]=="STOP_FRAME" else "PROCEED"
        # Hash segment для зберігання у hash-memory
        frame_result['hash_segment'] = hashlib.sha256(str(sorted(frame_result.items())).encode()).hexdigest()
        self.decision_log.append(frame_result)
        return frame_result
