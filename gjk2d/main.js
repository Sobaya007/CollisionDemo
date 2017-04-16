class Circle {
  constructor() {
    const r = Math.random() * 0.8 + 0.2;
    const center = new THREE.Vector2(Math.random() * 2 - 1, Math.random() * 2 - 1);
    const geom = new THREE.CircleGeometry(r, 100);
    const mat = new THREE.MeshBasicMaterial({color : 0xffffff, side: THREE.DoubleSide});
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(center.x, center.y, 0);
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
  const a0 = Math.random() * 2 * Math.PI;
  const v0 = new THREE.Vector2(Math.cos(a0), Math.sin(a0));
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
  while (true) {
    //5
    const v2 = new THREE.Vector2(p0.y-p1.y, p1.x-p0.x).normalize();
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
    //7
    const isOutside = (p, e0, e1) => {
      const n = new THREE.Vector2(e0.y-e1.y, e1.x-e0.x);
      if (n.dot(e0) > 0) {
        n.negate();
      }
      if (n.dot(p) < 0) return true;
      return false;
    };
    if (isOutside(p0, p1, p2)) {
      [p0, p1] = [p1, p2];
      yield {points: [p0, p1], removed : true};
      continue;
    }
    if (isOutside(p1, p2, p0)) {
      [p0, p1] = [p2, p0];
      yield {points: [p0, p1], removed : true};
      continue;
    }
    if (isOutside(p2, p0, p1)) {
      [p0, p1] = [p0, p1];
      yield {points: [p0, p1], removed : true};
      continue;
    }
    yield {end: 2};
    return true;
  }
};

const animate = _ => {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);

  arrowRate += 0.01;
  const len = 1 - 1 / (1 + arrowRate * 20);
  arrow.forEach(remove);
  arrow.length = 0;
  if (info.vector) {
    arrow = makeArrow(info.vector.clone().multiplyScalar(len * 0.3));
    arrow.forEach(a => scene.add(a));
  }
};

const makePoint = (p, c = 0x0000ff) => {
  const geom = new THREE.CircleGeometry(0.05, 10);
  const mat = new THREE.MeshBasicMaterial({color : c, side : THREE.DoubleSide});
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(p.x, p.y, 0);
  return mesh;
};

const makeLine = (p0, p1) => {
  p0 = new THREE.Vector3(p0.x, p0.y, 0);
  p1 = new THREE.Vector3(p1.x, p1.y, 0);
  const len = p0.distanceTo(p1);
  const geom = new THREE.BoxGeometry(len, 0.01);
  const mat = new THREE.LineBasicMaterial({color : 0x000000});
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set((p0.x+p1.x)/2, (p0.y+p1.y)/2, 0);
  mesh.rotation.set(0,0,new THREE.Vector2().subVectors(p1, p0).angle());
  return mesh;
};

const makeArrow = d => {
  const scene = new THREE.Scene();
  const mat = new THREE.MeshBasicMaterial({color : 0xff0000});
  const sq = new THREE.Mesh(new THREE.BoxGeometry(d.length(), 0.05), mat);
  const tr = new THREE.Mesh(new THREE.CircleGeometry(0.1, 3), mat);
  sq.position.set(d.x/2, d.y/2, 0);
  tr.position.set(d.x, d.y, 0);
  sq.rotation.set(0,0,d.angle());
  tr.rotation.set(0,0,d.angle());
  return [sq, tr];
};

const renderer = new THREE.WebGLRenderer();
renderer.setClearColor(0x000000);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(500, 500);
document.getElementById("container").appendChild(renderer.domElement);

const camera = new THREE.OrthographicCamera(2, -2, 2, -2, -2, 2);
camera.lookAt(new THREE.Vector3(0,0,1));

const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff));

//origin
const origin = makePoint(new THREE.Vector2(0,0))
origin.renderOrder = 1;
scene.add(origin);

const output = document.getElementById("output");
output.innerHTML = "Press button";

let circle = new Circle();
let arrow = [];
let arrowRate = 0;
let info = {};
let g = GJK(circle.support);

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
      remove(circle.mesh);
      circle = new Circle();
      g = GJK(circle.support);
      output.innerHTML = "Press button";
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
        output.innerHTML = "すでにある辺に垂直で、原点に向かう方向にベクトルをとる";
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
        output.innerHTML = "三角形が原点を含んでいるため終了";
        break;
    }
  }
};
