import cv2, numpy as np
from scipy.ndimage import gaussian_filter1d
d=np.load('lp_pose.npz');P=d['P'].astype(np.float32);Mk=d['M']
cap=cv2.VideoCapture('demo/assets/lat-pulldown.mp4');frames=[]
while True:
  ok,f=cap.read()
  if not ok:break
  frames.append(f)
n=len(frames);H,W=frames[0].shape[:2]
xy=P[:,:,:2]*np.array([W,H],np.float32)
xy=gaussian_filter1d(xy,1.6,axis=0,mode='wrap')
def ang(a,b,c):
  v1=a-b;v2=c-b;return np.degrees(np.arccos(np.clip((v1*v2).sum(-1)/np.linalg.norm(v1,axis=-1)/np.linalg.norm(v2,axis=-1),-1,1)))
el=ang(xy[:,12],xy[:,14],xy[:,16])
el=gaussian_filter1d(el,2,mode='wrap')
f=(el.max()-el)/(el.max()-el.min())        # 0 arms up, 1 pulled down
inten=0.22+0.78*(f*f*(3-2*f))
np.save('inten.npy',inten);print('elbow range',el.min(),el.max())
RED=np.array([48,59,255],np.float32)   # BGR
SOFT=np.array([128,138,255],np.float32)
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
import subprocess
ffp=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s',f'{W}x{H}','-r','30','-i','-','-c:v','libx264','-preset','slow','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart','demo/assets/lat-pulldown-muscles.mp4'],stdin=subprocess.PIPE)
dbg=[]
for i in range(n):
  fr=frames[i].astype(np.float32);m=Mk[i].astype(np.float32)
  m=cv2.GaussianBlur(m,(0,0),1.5)
  S=(xy[i,11]+xy[i,12])/2; Hp=(xy[i,23]+xy[i,24])/2
  v=Hp-S;L=np.linalg.norm(v);v/=L
  nrm=np.array([-v[1],v[0]])
  front=xy[i,0]-S
  if np.dot(nrm,front)>0:nrm=-nrm     # nrm -> back
  rx=xx-S[0];ry=yy-S[1]
  t=(rx*v[0]+ry*v[1])/L; u=(rx*nrm[0]+ry*nrm[1])/L
  # lats: from back contour forward, wide at armpit, narrowing to waist
  body=m>0.5
  tb=np.clip(((t-0.10)/0.78*24).astype(int),-1,24)
  umax=np.full(25,np.nan);umin=np.full(25,np.nan)
  for b in range(25):
    sel=body&(tb==b)
    if sel.any():umax[b]=u[sel].max();umin[b]=max(u[sel].min(),-0.32)
  ok=~np.isnan(umax);idx=np.arange(25)
  umax=np.interp(idx,idx[ok],umax[ok]);umin=np.interp(idx,idx[ok],umin[ok])
  umax=np.convolve(np.pad(umax,2,mode='edge'),np.ones(5)/5,'valid');umin=np.convolve(np.pad(umin,2,mode='edge'),np.ones(5)/5,'valid')
  tc=np.clip(tb,0,24);UM=umax[tc];Um=umin[tc]
  tn=np.clip((t-0.10)/0.78,0,1)
  wf=0.78-0.36*tn
  lat=((t>0.10)&(t<0.88)&(u>UM-wf*(UM-Um))).astype(np.float32)
  top=np.clip((t-0.10)/0.12,0,1);bot=np.clip((0.88-t)/0.22,0,1)
  edge=np.clip((u-(UM-wf*(UM-Um)))/0.05,0,1)
  lat*=top*bot*edge*np.clip(m,0,1)
  # fibers: from armpit diagonally to lower back
  fd=v+nrm*0.55;fd/=np.linalg.norm(fd);pp=np.array([-fd[1],fd[0]])
  fib=0.9+0.1*np.sin((rx*pp[0]+ry*pp[1])/2.6)
  def capsule(a,b,r):
    ab=b-a;tt=np.clip(((xx-a[0])*ab[0]+(yy-a[1])*ab[1])/(ab@ab),0,1)
    dx=xx-(a[0]+tt*ab[0]);dy=yy-(a[1]+tt*ab[1]);return np.sqrt(dx*dx+dy*dy)<r,tt
  sh=xy[i,12];elb=xy[i,14];ua=np.linalg.norm(elb-sh)
  armcap,tt=capsule(sh,elb,ua*0.17)
  lat*=~armcap
  # biceps: middle of upper arm
  ab=elb-sh;side=((xx-sh[0])*(-ab[1])+(yy-sh[1])*ab[0]);fr_sign=np.sign((front[0])*(-ab[1])+front[1]*ab[0])
  bic=(armcap&(tt>0.18)&(tt<0.9)&(side*fr_sign>-ua*0.03)).astype(np.float32)*np.clip(m,0,1)
  # rear delt: small blob behind shoulder
  rd_c=S+nrm*L*0.06+v*L*0.03
  rd=np.zeros_like(lat)
  I=inten[i]
  core=cv2.GaussianBlur(lat,(0,0),4)*fib
  dil=cv2.dilate((m>0.4).astype(np.uint8),np.ones((25,25),np.uint8)).astype(np.float32);dil=cv2.GaussianBlur(dil,(0,0),8)
  halo=cv2.GaussianBlur(lat,(0,0),18)*dil
  sec=cv2.GaussianBlur(np.maximum(bic,rd*0.9),(0,0),5)
  # stage: dim background, keep person
  bgdim=0.62+0.38*m
  o=fr*bgdim[...,None]
  lum=o.mean(-1,keepdims=True)
  # tint core (multiply-ish with red) + additive halo
  a=(core*(0.30+0.55*I))[...,None]
  o=o*(1-a)+(np.maximum(lum,40)*0.35+RED*0.85)*a
  a2=(sec*(0.30+0.45*I))[...,None]
  o=o*(1-a2)+(np.maximum(lum,40)*0.3+SOFT*0.8)*a2
  o=o+(halo*(0.25+0.55*I))[...,None]*RED*0.55
  o=np.clip(o,0,255).astype(np.uint8)
  ffp.stdin.write(o.tobytes())
  if i%27==0:dbg.append(cv2.resize(o,(270,480)))
ffp.stdin.close();ffp.wait();cv2.imwrite('dbg2.jpg',np.hstack(dbg))
