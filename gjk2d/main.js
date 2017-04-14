const renderer = new THREE.WebGLRenderer();
renderer.setClearColor(0x000000);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(500, 500);
document.getElementById("container").appendChild(renderer.domElement);

const camera = new THREE.OrthographicCamera(2, -2, 2, -2, -2, 2);
camera.lookAt(new THREE.Vector3(0,0,1));

const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff));

class Vertex {
  constructor(p) {
    this.p = p;
  }
};

class Edge {
  constructor(p0, p1) {
    this.s = p0;
    this.e = p1;
  }
}

class Convex {
  constructor(support) {
    this.support = support;
  }
}

class Circle {
  constructor() {
    const r = Math.random() * 0.8 + 0.2;
    const center = new THREE.Vector2(Math.random() * 2 - 1, Math.random() * 2 - 1);
    this.convex = new Convex(v => v.clone().multiplyScalar(r).add(center));
    const geom = new THREE.CircleGeometry(r, 100);
    const mat = new THREE.MeshBasicMaterial({color : 0xffffff, side: THREE.DoubleSide});
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(center.x, center.y, 0);
    scene.add(mesh);
    this.mesh = mesh;
  }
}

const remove = mesh => {
  scene.remove(mesh);
  mesh.geometry.dispose();
  mesh.material.dispose();
};


function* GJK(shape) {
  //1
  const a0 = Math.random() * 2 * Math.PI;
  const v0 = new THREE.Vector2(Math.cos(a0), Math.sin(a0));
  let p0 = shape.support(v0);
  yield {
    points: [p0],
    vector: v0
  };
  //2
  if (p0.x === 0 && p0.y === 0 && p0.z === 0) return false;
  //3
  const v1 = new THREE.Vector2(-p0.x, -p0.y).normalize();
  let p1 = shape.support(v1);
  yield {
    points: [p0, p1],
    vector: v1
  };
  //4
  if (v1.dot(p1) < 0) return false;
  while (true) {
    //5
    const v2 = new THREE.Vector2(p0.y-p1.y, p1.x-p0.x).normalize();
    if (v2.dot(p0) > 0) {
      v2.x = -v2.x;
      v2.y = -v2.y;
    }
    let p2 = shape.support(v2);
    yield {
      points: [p0, p1, p2],
      vector: v2
    };
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
    return true;
  }
};

let circle = new Circle();
const edges = [];
const circles = [];
let arrow = [];
let arrowRate = 0;
let info;
let g = GJK(circle.convex);
const animate = _ => {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);

  arrowRate += 0.01;
  const len = 1 - 1 / (1 + arrowRate * 2);
  arrow.forEach(remove);
  arrow.length = 0;
  if (info) {
    arrow = makeArrow(info.vector.clone().multiplyScalar(len));
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

const makeLine = (p0, p1) => {
  p0 = new THREE.Vector3(p0.x, p0.y, 0);
  p1 = new THREE.Vector3(p1.x, p1.y, 0);
  const geom = new THREE.Geometry();
  geom.vertices.push(p0);
  geom.vertices.push(p1);
  const mat = new THREE.LineBasicMaterial({color : 0});
  const mesh = new THREE.Line(geom, mat);
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

//origin
const origin = makePoint(new THREE.Vector2(0,0))
origin.renderOrder = 1;
scene.add(origin);

const clear = _ => {
  edges.forEach(remove);
  edges.length = 0;
  circles.forEach(remove);
  circles.length = 0;
};

document.onkeydown = function() {
  const res = g.next();
  if (res.done) {
    if (res.value !== undefined) {
    document.getElementById("output").innerHTML = res.value ? "衝突した" : "衝突してない";
    } else {
    document.getElementById("output").innerHTML = "";
      info = undefined;
      clear();
      remove(circle.mesh);
      circle = new Circle();
      g = GJK(circle.convex);
    }
    return;
  }
  const v = res.value;
  info = v;
  arrowRate = 0;
  clear();
  const points = info.points;
  points.forEach(p => {
    const c = makePoint(p, 0xff0000);
    circles.push(c);
    scene.add(c);
  });
  if (points.length === 2) {
    const edge = makeLine(...points);
    scene.add(edge);
    edges.push(edge);
  } else if (points.length === 3) {
    for (let i = 0; i < 3; i++) {
      const j = (i+1) % 3;
      const edge = makeLine(points[i], points[j]);
      scene.add(edge);
      edges.push(edge);
    }
  }
};
