class Edge {
  constructor(p0, p1) {
    this.p0 = p0;
    this.p1 = p1;
  }

  equals(e) {
    return this.p0.equals(e.p0) && this.p1.equals(e.p1) || this.p0.equals(e.p1) && this.p1.equals(e.p0);
  }
}

class Face {
  constructor(p0, p1, p2) {
    this.p0 = p0;
    this.p1 = p1;
    this.p2 = p2;
    this.e0 = new Edge(p0, p1);
    this.e1 = new Edge(p1, p2);
    this.e2 = new Edge(p2, p0);
  }
}

class Convex {
  constructor(support) {
    this.support = support;
    this.faces = [];
  }
}

class Sphere {
  constructor() {
    const r = Math.random() * 1 + 0.8;
    const t = Math.random() * 2 * Math.PI;
    const p = Math.random() * Math.PI - Math.PI / 2;
    const d = r / 2; //中心位置を調整して、絶対に原点を含むことにする(デモ用)
    const center = new THREE.Vector3(d * Math.cos(t) * Math.cos(p), d * Math.sin(p), d * Math.sin(t) * Math.cos(p));
    this.support = v => v.clone().multiplyScalar(r).add(center);
    const geom = new THREE.SphereGeometry(r, 10, 10);
    const mat = new THREE.MeshBasicMaterial({color: 0xffffff, opacity: 0.8, transparent: true, side : THREE.FrontSide});
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(center.x, center.y, center.z);
    const mat2 = new THREE.MeshBasicMaterial({color: 0xffffff, opacity: 0.8, transparent: true, side : THREE.BackSide});
    const mesh2 = new THREE.Mesh(geom, mat);
    mesh2.position.set(center.x, center.y, center.z);
    scene.add(mesh);
    scene.add(mesh2);
    this.mesh = [mesh, mesh2];
  }
}

const remove = mesh => {
  if (!mesh) return;
  scene.remove(mesh);
  mesh.geometry.dispose();
  mesh.material.dispose();
};

//本来は物体が原点を含むかどうかの真偽を返せばよいが、EPAにつなげる関係上、
//当たらなかったらfalseを当たったら原点を含む四面体を返す関数としている
function GJK(support) {
  //1
  const theta = Math.random() * 2 * Math.PI;
  const phi = Math.random() * Math.PI - Math.PI / 2;
  const v0 = new THREE.Vector3(Math.cos(theta) * Math.cos(phi), Math.sin(phi), Math.sin(theta) * Math.cos(phi));
  let p0 = support(v0);
  //2
  if (p0.x === 0 && p0.y === 0 && p0.z === 0) {
    return true;
  }
  //3
  const v1 = p0.clone().negate().normalize();
  let p1 = support(v1);
  //4
  if (v1.dot(p1) < 0) {
    return false;
  }
  //5
  const getOrtho = (x,y,z) => {
    if (x !== 0) {
      return new THREE.Vector3(-(y + z) / x, 1, 1).normalize();
    } else if (y !== 0) {
      return new THREE.Vector3(1, -(z + x) / y, 1).normalize();
    } else {
      return new THREE.Vector3(1, 1, -(x + y) / z).normalize();
    }
  };
  const v2 = getOrtho(p0.x-p1.x, p0.y-p1.y, p0.z-p1.z);
  if (v2.dot(p0) > 0) {
    v2.negate();
  }
  let p2 = support(v2);
  //6
  if (v2.dot(p2) < 0) {
    return false;
  }
  while (true) {
    //7
    const v3 = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p2, p1)).normalize();
    if (v3.dot(p0) > 0) {
      v3.negate();
    }
    let p3 = support(v3);
    //8
    if (v3.dot(p3) < 0) {
      return false;
    }
    //9
    const isOutside = (p, f0, f1, f2) => {
      const n = new THREE.Vector3().subVectors(f1, f0).cross(new THREE.Vector3().subVectors(f2, f1)).normalize();
      if (n.dot(f0) > 0) {
        n.negate();
      }
      if (n.dot(p) < 0) return true;
      return false;
    };
    if (isOutside(p0, p1, p2, p3)) {
      [p0, p1, p2] = [p1, p2, p3];
      continue;
    }
    if (isOutside(p1, p2, p3, p0)) {
      [p0, p1, p2] = [p2, p3, p0];
      continue;
    }
    if (isOutside(p2, p3, p0, p1)) {
      [p0, p1, p2] = [p3, p0, p1];
      continue;
    }
    if (isOutside(p3, p0, p1, p2)) {
      [p0, p1, p2] = [p0, p1, p2];
      continue;
    }
    return [p0, p1, p2, p3];
  }
};

function* EPA(support) {
  //1
  const gjkResult = GJK(support);
  //2
  if (!gjkResult) return null;
  //3
  if (gjkResult.length < 4) {
    return new THREE.Vector3(0,0,0);
  }
  const convex = new Convex(support);
  convex.faces.push(new Face(gjkResult[0], gjkResult[1], gjkResult[2]));
  convex.faces.push(new Face(gjkResult[1], gjkResult[2], gjkResult[3]));
  convex.faces.push(new Face(gjkResult[2], gjkResult[3], gjkResult[0]));
  convex.faces.push(new Face(gjkResult[3], gjkResult[0], gjkResult[1]));
  let beforePos;
  const g = convex.faces.map(f => new THREE.Vector3().addVectors(f.p0, f.p1).add(f.p2)).reduce((a,b) => a.add(b)).multiplyScalar(1/12);
  yield {faces: convex.faces, first: true};
  while (true) {
    //4
    const distToFace = (f0, f1, f2) => {
      const fn = new THREE.Vector3().subVectors(f0, f1).cross(new THREE.Vector3().subVectors(f1, f2)).normalize();
      let p = fn.clone().multiplyScalar(fn.dot(f0));
      const clampToEdge = (p, e0, e1, o) => {
        const en = new THREE.Vector3().subVectors(e0, e1).cross(fn.clone()).normalize();
        if (en.dot(new THREE.Vector3().subVectors(o, e0)) < 0) {
          en.negate();
        }
        if (en.dot(new THREE.Vector3().subVectors(p, e0) < 0)) {
          //return p - (en, (p-e0))en
          return new THREE.Vector3().subVectors(p, en.multiplyScalar(new THREE.Vector3().subVectors(p, e0).dot(en)));
        }
        return p;
      };
      p = clampToEdge(p, f0, f1, f2);
      p = clampToEdge(p, f1, f2, f0);
      p = clampToEdge(p, f2, f0, f1);
      return p.length();
    };
    const nearestFaceInfo = convex.faces.map(f => ({face:f, dist:distToFace(f.p0, f.p1, f.p2)})).reduce((a,b) => a.dist < b.dist ? a : b);
    const nearestFace = nearestFaceInfo.face;
    yield {face: nearestFace};
    const normal = new THREE.Vector3().subVectors(nearestFace.p0, nearestFace.p1).cross(new THREE.Vector3().subVectors(nearestFace.p1, nearestFace.p2)).normalize();
    if (normal.dot(new THREE.Vector3().subVectors(nearestFace.p0, g)) < 0) {
      normal.negate();
    }
    yield {vector: normal};
    const newPos = convex.support(normal);
    yield {newPos: newPos};
    //5.
    const canSee = (f0, f1, f2) => {
      const n = new THREE.Vector3().subVectors(f0, f1).cross(new THREE.Vector3().subVectors(f1, f2)).normalize();
      if (n.dot(new THREE.Vector3().subVectors(f0, g)) < 0) {
        n.negate();
      }
      return n.dot(new THREE.Vector3().subVectors(f0, newPos)) < 0;
    };
    let edges = [];
    const faces = [];
    convex.faces = convex.faces.filter(f => {
      if (canSee(f.p0, f.p1, f.p2)) {
        edges.push(f.e0);
        edges.push(f.e1);
        edges.push(f.e2);
        return false;
      } else {
        return true;
      }
    });
    edges = edges.filter((e,i) => edges.every((e2,j) => i == j || !e.equals(e2)));
    edges.forEach(e => convex.faces.push(new Face(newPos, e.p0, e.p1)));
    yield {faces: convex.faces};
    //6.
    if (beforePos) {
      if (beforePos.distanceTo(newPos) < 0.1) {
        return {result: normal.multiplyScalar(normal.dot(nearestFace.p0))};
      }
    }
    beforePos = newPos;
    yield {beforePos: beforePos};
  }
}

const animate = _ => {
  requestAnimationFrame(animate);
  control.update();
  renderer.render(scene, camera);

  arrowRate += 0.01;
  const len = 1 - 1 / (1 + arrowRate * 20);
  arrow.forEach(remove);
  arrow.length = 0;
  if (info.vector) {
    arrow = makeArrow(info.vector.clone().multiplyScalar(len * 1));
    arrow.forEach(a => scene.add(a));
  }
};

const makePoint = (p, c = 0x0000ff) => {
  const geom = new THREE.SphereGeometry(0.05);
  const mat = new THREE.MeshBasicMaterial({color : c, side : THREE.DoubleSide});
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(p.x, p.y, p.z);
  return mesh;
};

const makeLine = (p0, p1) => {
  const len = p0.distanceTo(p1);
  const geom = new THREE.BoxGeometry(0.02, 0.02, len);
  const mat = new THREE.LineBasicMaterial({color : 0x000000});
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set((p0.x+p1.x)/2, (p0.y+p1.y)/2, (p0.z+p1.z)/2);
  mesh.lookAt(p1.clone());
  return mesh;
};

const makeFace = (p0, p1, p2) => {
  const geom = new THREE.Geometry();
  geom.vertices.push(p0);
  geom.vertices.push(p1);
  geom.vertices.push(p2);
  geom.faces.push(new THREE.Face3(0,1,2));
  const mat = new THREE.MeshBasicMaterial({color : 0xc0c0ff, side : THREE.FrontSide, transparent: true, opacity : 0.5});
  const mesh = new THREE.Mesh(geom, mat);
  const mat2 = new THREE.MeshBasicMaterial({color : 0xc0c0ff, side : THREE.BackSide, transparent: true, opacity : 0.5});
  const mesh2 = new THREE.Mesh(geom, mat2);
  return [mesh, mesh2] ;
};

const makeArrow = d => {
  const n = d.clone().normalize();
  const scene = new THREE.Scene();
  const mat = new THREE.MeshNormalMaterial({side : THREE.DoubleSide});
  const headGeom = new THREE.CylinderGeometry(0, 0.06, 0.1);
  headGeom.rotateX(Math.PI/2);
  const head = new THREE.Mesh(headGeom, mat);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, d.length()-0.1), mat);
  head.position.set(d.x-n.x*0.1, d.y-n.y*0.1, d.z-n.z*0.1);
  tail.position.set(d.x/2, d.y/2, d.z/2);
  head.lookAt(d.clone().multiplyScalar(2));
  tail.lookAt(d.clone());
  return [head, tail];
};

const renderer = new THREE.WebGLRenderer({antialias : true});
renderer.setClearColor(0x000000);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(500, 500);
document.getElementById("container").appendChild(renderer.domElement);

const camera = new THREE.OrthographicCamera(3, -3, 3, -3, -3, 8);
camera.position.set(0,0,-1);
camera.lookAt(new THREE.Vector3(0,0,1));

const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0x505050));

const control = new THREE.TrackballControls(camera);
control.enableDamping = true;
control.enableZoom = true;
control.rotateSpeed = 1;

//origin
const origin = makePoint(new THREE.Vector3(0,0,0))
origin.renderOrder = 1;
scene.add(origin);

const output = document.getElementById("output");
output.innerHTML = "Press button";

let sphere = new Sphere();
let arrow = [];
let arrowRate = 0;
let info = {};
let g = EPA(sphere.support);
let hasStarted = false;

animate();

window.step = function() {
  const res = g.next();
  if (res.done) {
    if (res.value) {
      info.vector = undefined;
      info.result = makeArrow(res.value.result);
      info.result.forEach(a => scene.add(a));
      remove(info.beforePos);
      remove(info.newPos);
      output.innerHTML = "めりこみ解消ベクトルは青い矢印";
      if(res.value) {
        sphere.mesh.map(m => m.material.color.setRGB(1,1,0));
      } else {
        sphere.mesh.map(m => m.material.color.setRGB(0,1,1));
      }
      return true;
    }
    remove(info.face);
    info.faces.forEach(remove);
    info.result.forEach(remove);
    remove(sphere.mesh[0]);
    remove(sphere.mesh[1]);
    sphere = new Sphere();
    g = EPA(sphere.support);
    output.innerHTML = "Press button";
    return;
  }
  const next = res.value;
  if (next.beforePos) {
    remove(info.beforePos);
    scene.add(info.beforePos = makePoint(next.beforePos, 0x00ff00));
  }
  if (next.newPos) {
    remove(info.newPos);
    scene.add(info.newPos = makePoint(next.newPos, 0xffff00));
    output.innerHTML = "法線方向にサポート写像をとる";
  }
  if (next.face) {
    const faces = info.faces.filter(f => f.geometry instanceof THREE.Geometry)
      .filter(f => f.geometry.vertices[0] === next.face.p0
        && f.geometry.vertices[1] === next.face.p1
        && f.geometry.vertices[2] === next.face.p2);
    faces.map(f => f.material.color.setRGB(1,0,0));
    output.innerHTML = "最も近い面を算出";
  }
  if (next.faces) {
    remove(info.face);
    if (info.faces)
      info.faces.forEach(remove);
    info.faces = next.faces.map(a => makeFace(a.p0, a.p1, a.p2)).reduce((a,b) => a.concat(b));
    next.faces.forEach(a => {
      info.faces.push(makeLine(a.p0, a.p1));
      info.faces.push(makeLine(a.p1, a.p2));
      info.faces.push(makeLine(a.p2, a.p0));
    });
    info.faces.forEach(a => scene.add(a));

    if (next.first) {
      output.innerHTML = "GJKで原点を含む四面体を作成";
    } else {
      output.innerHTML = "新たな点を追加";
    }
  }
  if (next.vector) {
    arrowRate = 0;
    info.vector = next.vector;
    output.innerHTML = "その面の法線を取得";
  }
};

window.stepAll = function() {
  if (hasStarted) return;
  hasStarted = true;
  const po = _ => {
    const res = window.step();
    if (!res) {
      setTimeout(po, 100);
    } else {
      hasStarted = false;
    }
  };
  setTimeout(po, 100);
};
