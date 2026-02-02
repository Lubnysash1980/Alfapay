class ShootingModel3D:
    def __init__(self, model_signature: dict):
        self.signature = model_signature

    def similarity(self, frame_data: dict) -> float:
        score = 0
        total = len(self.signature)
        for key in self.signature:
            if key in frame_data and frame_data[key] == self.signature[key]:
                score += 1
        return score / total

def ai_director_control(frame_data, model_3d, threshold=0.95):
    match_score = model_3d.similarity(frame_data)
    if match_score < threshold:
        return {"status": "STOP_FRAME", "match": match_score, "timestamp": frame_data['timestamp']}
    return {"status": "ACCEPT", "match": match_score, "timestamp": frame_data['timestamp']}
