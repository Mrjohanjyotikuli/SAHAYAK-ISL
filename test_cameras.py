"""Find available camera indexes. Run: python test_cameras.py"""
import cv2

print("Testing camera indexes 0-5. Close Camera/Zoom/Teams first.")
for index in range(6):
    cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
    ok = cap.isOpened()
    frame_ok = False
    if ok:
        frame_ok, frame = cap.read()
        if frame_ok:
            cv2.putText(frame, f"Camera index {index} - press any key to close", (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0,255,0), 2)
            cv2.imshow(f"SAHAYAK camera test - index {index}", frame)
            cv2.waitKey(900)
            cv2.destroyWindow(f"SAHAYAK camera test - index {index}")
    cap.release()
    print(f"Index {index}: {'WORKING' if ok and frame_ok else 'not available'}")
cv2.destroyAllWindows()
print("Use the index showing the USB webcam. If index 0 is laptop camera, USB is often 1 or 2.")
