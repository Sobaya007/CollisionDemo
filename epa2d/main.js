const renderer = new THREE.WebGLRenderer();
renderer.setClearColor(0x000000);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(500, 500);
document.getElementById("container").appendChild(renderer.domElement);

const camera = new THREE.OrthographicCamera(2, -2, 2, -2, -2, 2);
camera.lookAt(new THREE.Vector3(0,0,1));

const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff));

class Edge {
  constructor(p0, p1) {
    this.p0 = p0;
    this.p1 = p1;
  }
}

class Convex {
  constructor(support) {
    this.support = support;
    this.edges = [];
  }
}

class Circle {
  constructor() {
    this.r = Math.random() * 0.8 + 0.2;
    this.center = new THREE.Vector2(Math.random() * 2 - 1, Math.random() * 2 - 1);
    this.support = v => v.clone().multiplyScalar(this.r).add(this.center);
  }

  makeMesh() {
    const geom = new THREE.CircleGeometry(this.r, 100);
    const mat = new THREE.MeshBasicMaterial({color : 0xffffff, side: THREE.DoubleSide});
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(this.center.x, this.center.y, 0);
    scene.add(mesh);
    this.mesh = mesh;
  }
}

const remove = mesh => {
  if (!mesh) return;
  scene.remove(mesh);
  mesh.geometry.dispose();
  mesh.material.dispose();
};


function GJK(support) {
  //1
  const a0 = Math.random() * 2 * Math.PI;
  const v0 = new THREE.Vector2(Math.cos(a0), Math.sin(a0));
  let p0 = support(v0);
  //2
  if (p0.x === 0 && p0.y === 0 && p0.z === 0) return true;
  //3
  const v1 = new THREE.Vector2(-p0.x, -p0.y).normalize();
  let p1 = support(v1);
  //4
  if (v1.dot(p1) < 0) return false;
  while (true) {
    //5
    const v2 = new THREE.Vector2(p0.y-p1.y, p1.x-p0.x).normalize();
    if (v2.dot(p0) > 0) {
      v2.x = -v2.x;
      v2.y = -v2.y;
    }
    let p2 = support(v2);
    //6
    if (v2.dot(p2) < 0) return false;
    //7
    const isOutside = (p, e0, e1) => {
      const n = new THREE.Vector2(e0.y-e1.y, e1.x-e0.x);
      if (n.dot(e0) > 0) {
        n.x = -n.x;
        n.y = -n.y;
      }
      if (n.dot(p) < 0) return true;
      return false;
    };
    if (isOutside(p0, p1, p2)) {
      [p0, p1] = [p1, p2];
      continue;
    }
    if (isOutside(p1, p2, p0)) {
      [p0, p1] = [p2, p0];
      continue;
    }
    if (isOutside(p2, p0, p1)) {
      [p0, p1] = [p0, p1];
      continue;
    }
    return [p0,p1,p2];
  }
};

function* EPA(convex) {
  let beforePos;
  yield {edges: convex.edges, first: true};
  while (true) {
    const distToEdge = (e0, e1) => {
      const v = new THREE.Vector2(e1.x-e0.x, e1.y-e0.y);
      const edgeLen = v.length();
      let t = new THREE.Vector2(-e0.x, -e0.y).dot(v) / edgeLen / edgeLen;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      return e0.clone().add(v.multiplyScalar(t)).length();
    };
    const nearestEdgeInfo = convex.edges.map((e,i) => ({edge:e, index:i, dist:distToEdge(e.p0, e.p1)})).reduce((a,b) => a.dist < b.dist ? a : b);
    const nearestEdge = nearestEdgeInfo.edge;
    const nearestEdgeIndex = nearestEdgeInfo.index;
    yield {edge: nearestEdge};
    const normal = new THREE.Vector2(nearestEdge.p0.y-nearestEdge.p1.y, nearestEdge.p1.x-nearestEdge.p0.x).normalize();
    if (normal.dot(nearestEdge.p0) < 0) {
      normal.x = -normal.x;
      normal.y = -normal.y;
    }
    yield {vector: normal};
    const newPos = convex.support(normal);
    yield {newPos: newPos};
    //2.
    convex.edges.splice(nearestEdgeIndex, 1);
    convex.edges.push(new Edge(nearestEdge.p0, newPos));
    convex.edges.push(new Edge(nearestEdge.p1, newPos));
    yield {edges: convex.edges};
    //3.
    if (beforePos) {
      if (beforePos.distanceTo(newPos) < 0.1) {
        return {result: normal.multiplyScalar(normal.dot(nearestEdge.p0))};
      }
    }
    beforePos = newPos;
    yield {beforePos: beforePos};
  }
}

const edges = [];
const circles = [];
let arrow = [];
let arrowRate = 0;
let info = {};
let circle;
let g;
const init = _ => {
  circle = new Circle();
  let triangle = GJK(circle.support);
  while (!triangle) {
    circle = new Circle();
    triangle = GJK(circle.support);
  }
  let convex = new Convex(circle.support);
  convex.edges.push(new Edge(triangle[0], triangle[1]));
  convex.edges.push(new Edge(triangle[1], triangle[2]));
  convex.edges.push(new Edge(triangle[2], triangle[0]));
  g = EPA(convex);
  circle.makeMesh();
  scene.add(circle.mesh);
};
init();
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
animate();

const makePoint = (p, c = 0x0000ff) => {
  const geom = new THREE.CircleGeometry(0.05, 10);
  const mat = new THREE.MeshBasicMaterial({color : c, side : THREE.DoubleSide});
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(p.x, p.y, 0);
  return mesh;
};

const makeLine = (p0, p1, width, color=0) => {
  p0 = new THREE.Vector3(p0.x, p0.y, 0);
  p1 = new THREE.Vector3(p1.x, p1.y, 0);
  const len = p0.distanceTo(p1);
  const geom = new THREE.BoxGeometry(len, width);
  const mat = new THREE.LineBasicMaterial({color : color});
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set((p0.x+p1.x)/2, (p0.y+p1.y)/2, 0);
  mesh.rotation.set(0,0,new THREE.Vector2(p1.x-p0.x, p1.y-p0.y).angle());
  return mesh;
};

const makeArrow = (d, color = 0xff0000) => {
  const scene = new THREE.Scene();
  const mat = new THREE.MeshBasicMaterial({color : color});
  const sq = new THREE.Mesh(new THREE.BoxGeometry(d.length(), 0.05), mat);
  const tr = new THREE.Mesh(new THREE.CircleGeometry(0.1, 3), mat);
  sq.position.set(d.x/2, d.y/2, 0);
  tr.position.set(d.x, d.y, 0);
  sq.rotation.set(0,0,d.angle());
  tr.rotation.set(0,0,d.angle());
  return [sq, tr];
};

//origin
const origin = makePoint(new THREE.Vector2(0,0))
origin.renderOrder = 1;
scene.add(origin);

const clear = _ => {
  if (!info) return;
  remove(info.beforePos);
  remove(info.newPos);
  remove(info.edge);
  info.edges.forEach(remove);
  info.result.forEach(remove);
};

const output = document.getElementById("output");
output.innerHTML = "Press any key";
document.onkeydown = function() {
  const res = g.next();
  if (res.done) {
    if (res.value) {
      info.vector = undefined;
      info.result = makeArrow(res.value.result, 0x0000ff);
      info.result.forEach(a => scene.add(a));
      remove(info.beforePos);
      remove(info.newPos);
      output.innerHTML = "めりこみ解消ベクトルは青い矢印";
      return;
    }
    remove(info.edge);
    info.edges.forEach(remove);
    info.result.forEach(remove);
    remove(circle.mesh);
    init();
    output.innerHTML = "Press any key";
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
  if (next.edge) {
    scene.add(info.edge = makeLine(next.edge.p0, next.edge.p1, 0.03, 0x0000ff));
    output.innerHTML = "最も近い辺を算出";
  }
  if (next.edges) {
    remove(info.edge);
    if (info.edges)
      info.edges.forEach(remove);
    info.edges = next.edges.map(a => makeLine(a.p0, a.p1, 0.01));
    info.edges.forEach(a => scene.add(a));

    if (next.first) {
      output.innerHTML = "GJKで原点を含む三角形を作成";
    } else {
      output.innerHTML = "新たな点を追加";
    }
  }
  if (next.vector) {
    arrowRate = 0;
    info.vector = next.vector;
    output.innerHTML = "その辺の法線を取得";
  }
};
