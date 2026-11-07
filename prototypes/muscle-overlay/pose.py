import cv2, numpy as np, mediapipe as mp, sys
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision
src=sys.argv[1]; out=sys.argv[2]
opts=vision.PoseLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path='models/pose_heavy.task'),
  running_mode=vision.RunningMode.VIDEO,output_segmentation_masks=True,num_poses=1,
  min_pose_detection_confidence=0.4,min_tracking_confidence=0.4)
lm=vision.PoseLandmarker.create_from_options(opts)
cap=cv2.VideoCapture(src);fps=cap.get(5);P=[];M=[];i=0
while True:
  ok,fr=cap.read()
  if not ok:break
  img=mp.Image(image_format=mp.ImageFormat.SRGB,data=cv2.cvtColor(fr,cv2.COLOR_BGR2RGB))
  r=lm.detect_for_video(img,int(i*1000/fps))
  if r.pose_landmarks:
    P.append([[p.x,p.y,p.visibility] for p in r.pose_landmarks[0]])
    M.append((r.segmentation_masks[0].numpy_view()[...,0] if r.segmentation_masks[0].numpy_view().ndim==3 else r.segmentation_masks[0].numpy_view()).astype(np.float16))
  else:
    P.append(np.full((33,3),np.nan).tolist());M.append(np.zeros(fr.shape[:2],np.float16))
  i+=1
np.savez_compressed(out,P=np.array(P),M=np.array(M),fps=fps)
P=np.array(P);print('frames',i,'detected',np.sum(~np.isnan(P[:,0,0])))
for j,n in [(11,'Lsh'),(12,'Rsh'),(13,'Lel'),(14,'Rel'),(15,'Lwr'),(16,'Rwr'),(23,'Lhip'),(24,'Rhip')]:
  print(n,'vis mean %.2f'%np.nanmean(P[:,j,2]),'x %.2f y %.2f'%(np.nanmean(P[:,j,0]),np.nanmean(P[:,j,1])))
