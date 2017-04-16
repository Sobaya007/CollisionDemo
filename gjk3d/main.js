class Sphere {
  constructor() {
    const r = Math.random() * 0.5 + 0.4;
    const center = new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5);
    const geom = new THREE.SphereGeometry(r, 10, 10);
    const mat = new THREE.MeshNormalMaterial({opacity: 0.8, transparent: true});
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(center.x, center.y, center.z);
    scene.add(mesh);
    this.mesh = mesh;
    this.support = v => v.clone().multiplyScalar(r).add(center);
  }
}

const remove = mesh => {
  scene.remove(mesh);
  mesh.geometry.dispose();
  mesh.material.dispose();
};

function* GJK(support) {
  //1
  const theta = Math.random() * 2 * Math.PI;
  const phi = Math.random() * Math.PI - Math.PI / 2;
  const v0 = new THREE.Vector3(Math.cos(theta) * Math.cos(phi), Math.sin(phi), Math.sin(theta) * Math.cos(phi));
  yield {vector: v0, phase : 0};
  let p0 = support(v0);
  yield {points: [p0]};
  //2
  if (p0.x === 0 && p0.y === 0 && p0.z === 0) {
    yield {end: 0};
    return true;
  }
  //3
  const v1 = p0.clone().negate().normalize();
  yield {vector: v1, phase : 1};
  let p1 = support(v1);
  yield {points: [p0, p1]};
  //4
  if (v1.dot(p1) < 0) {
    yield {end: 1};
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
  yield {vector: v2, phase : 2};
  let p2 = support(v2);
  yield {points: [p0, p1, p2]};
  //6
  if (v2.dot(p2) < 0) {
    yield {end: 1};
    return false;
  }
  while (true) {
    //7
    const v3 = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p2, p1)).normalize();
    if (v3.dot(p0) > 0) {
      v3.negate();
    }
    yield {vector: v3, phase : 3};
    let p3 = support(v3);
    yield {points: [p0, p1, p2, p3]};
    //8
    if (v3.dot(p3) < 0) {
      yield {end: 1};
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
      yield {points: [p0, p1, p2], removed : true};
      continue;
    }
    if (isOutside(p1, p2, p3, p0)) {
      [p0, p1, p2] = [p2, p3, p0];
      yield {points: [p0, p1, p2], removed : true};
      continue;
    }
    if (isOutside(p2, p3, p0, p1)) {
      [p0, p1, p2] = [p3, p0, p1];
      yield {points: [p0, p1, p2], removed : true};
      continue;
    }
    if (isOutside(p3, p0, p1, p2)) {
      [p0, p1, p2] = [p0, p1, p2];
      yield {points: [p0, p1, p2], removed : true};
      continue;
    }
    yield {end: 2};
    return true;
  }
};

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
  const geom = new THREE.BoxGeometry(0.01, 0.01, len);
  const mat = new THREE.LineBasicMaterial({color : 0x000000});
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set((p0.x+p1.x)/2, (p0.y+p1.y)/2, (p0.z+p1.z)/2);
  mesh.lookAt(p1.clone());
  return mesh;
};

const makeArrow = d => {
  const scene = new THREE.Scene();
  const mat = new THREE.MeshNormalMaterial({side : THREE.DoubleSide});
  const headGeom = new THREE.CylinderGeometry(0, 0.06, 0.1);
  headGeom.rotateX(Math.PI/2);
  const head = new THREE.Mesh(headGeom, mat);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, d.length()), mat);
  head.position.set(d.x, d.y, d.z);
  tail.position.set(d.x/2, d.y/2, d.z/2);
  head.lookAt(d.clone().multiplyScalar(2));
  tail.lookAt(d.clone());
  return [head, tail];
};

const renderer = new THREE.WebGLRenderer();
renderer.setClearColor(0x000000);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(500, 500);
document.getElementById("container").appendChild(renderer.domElement);

const camera = new THREE.OrthographicCamera(3, -3, 3, -3, -3, 3);
camera.position.set(0,0,-1);
camera.lookAt(new THREE.Vector3(0,0,1));

const scene = new THREE.Scene();
scene.add(new THREE.PointLight(0xffffff));
scene.add(new THREE.AmbientLight(0x505050));

const control = new THREE.TrackballControls(camera);
control.enableDamping = true;
control.enableZoom = true;
control.rotateSpeed = 1;

//origin
const origin = makePoint(new THREE.Vector3(0,0,0))
origin.renderOrder = 1;
scene.add(origin);

var sphere = new Sphere();
let arrow = [];
let arrowRate = 0;
let info = {};
let g = GJK(sphere.support);

const output = document.getElementById("output");
output.innerHTML = "Press button";

animate();

window.step = function() {
  const res = g.next();
  if (res.done) {
    if (res.value !== undefined) {
      output.innerHTML = res.value ? "衝突した" : "衝突してない";
    } else {
      info.vector = undefined;
      info.points.forEach(remove);
      info.edges.forEach(remove);
      remove(sphere.mesh);
      sphere = new Sphere();
      g = GJK(sphere.support);
    }
    return;
  }
  const next = res.value;
  if (next.points) {
    if (info.points) info.points.forEach(remove);
    info.points = next.points.map(a => makePoint(a, 0xff0000));
    info.points.forEach(a => scene.add(a));
    if (info.edges) info.edges.forEach(remove);
    if (next.points.length === 2) {
      const edge = makeLine(...next.points);
      scene.add(edge);
      info.edges = [edge];
    } else if (next.points.length === 3) {
      info.edges = [];
      for (let i = 0; i < 3; i++) {
        const j = (i+1) % 3;
        const edge = makeLine(next.points[i], next.points[j]);
        scene.add(edge);
        info.edges.push(edge);
      }
    } else if (next.points.length === 4) {
      for (let i = 0; i < 4; i++) {
        for (let j = i+1; j < 4; j++) {
          const edge = makeLine(next.points[i], next.points[j]);
          scene.add(edge);
          info.edges.push(edge);
        }
      }
    }
    if (next.removed) {
      output.innerHTML = "原点から見えない点を削除";
    } else {
      output.innerHTML = "サポート写像をとる";
    }
  }
  if (next.vector) {
    arrowRate = 0;
    info.vector = next.vector;
    switch (next.phase) {
      case 0:
        output.innerHTML = "適当な方向にベクトルをとる";
        break;
      case 1:
        output.innerHTML = "最初の頂点と逆方向にベクトルをとる";
        break;
      case 2:
        output.innerHTML = "すでにある辺に垂直で、原点に向かう向きのベクトルを適当にとる";
        break;
      case 3:
        output.innerHTML = "すでにある面に垂直で、原点から向かう方向にベクトルをとる";
        break;
    }
  }
  if (next.end != undefined) {
    switch (next.end) {
      case 0:
        output.innerHTML = "サポート頂点が原点であるため終了";
        break;
      case 1:
        output.innerHTML = "原点方向に向かったのに、原点を越せなかったため終了";
        break;
      case 2:
        output.innerHTML = "四面体が原点を含んでいるため終了";
        break;
    }
  }
};
