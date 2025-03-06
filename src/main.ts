import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

// -----------------------------
// 1) Basic Scene Setup
// -----------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd1e5);

const camera = new THREE.PerspectiveCamera(
  30,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 1.7, 5);
camera.rotateX(-0.1);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;

const container = document.getElementById('sceneContainer');
if (!container) throw new Error('No #sceneContainer in HTML');
container.appendChild(renderer.domElement);

// -----------------------------
// HANDLE WINDOW RESIZE
// -----------------------------
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// -----------------------------
// 2) Lights
// -----------------------------
const ambientLight = new THREE.AmbientLight(0x404040, 1);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
scene.add(hemiLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

// -----------------------------
// 3) Environment Map with PMREM
// -----------------------------
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
new RGBELoader().load('/envmap.hdr', (hdrTexture) => {
  const envMap = pmrem.fromEquirectangular(hdrTexture).texture;
  scene.environment = envMap;
  hdrTexture.dispose();
  pmrem.dispose();
});

// -----------------------------
// 4) Floor, Walls & Ceiling
// -----------------------------
// Floor: a 5x5 floor with a little thickness
const floorGeom = new THREE.BoxGeometry(5.05, 5, 0.05);
const floorMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
const floor = new THREE.Mesh(floorGeom, floorMat);
floor.rotation.x = -Math.PI / 2;
// Shift up so that the top of the floor is at y=0.
floor.position.y = 0.05 / 2;
floor.userData = { ground: true }; // mark as ground for raycasting
scene.add(floor);

// Walls: we'll store them in an array for clamping.
const walls: THREE.Object3D[] = [];
const wallHeight = 2.5;
const wallGeom = new THREE.BoxGeometry(5, wallHeight, 0.05);

// Ceiling: a 5x5 ceiling with a little thickness
const ceilingGeom = new THREE.BoxGeometry(5.05, 5, 0.05);
const ceilingMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
const ceiling = new THREE.Mesh(ceilingGeom, ceilingMat);
ceiling.rotation.x = -Math.PI / 2;
ceiling.position.y = 2.5;
scene.add(ceiling);

function createWall(x: number, y: number, z: number, rotY: number, rotX: number = 0) {
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xe0e0e0 });
  const wall = new THREE.Mesh(wallGeom, wallMat);
  wall.position.set(x, y, z);
  wall.rotation.y = rotY;
  wall.rotation.x = rotX;
  scene.add(wall);
  walls.push(wall);
}

// Create three walls (you can add the front wall if desired)
createWall(0, wallHeight / 2, -2.5, 0);
createWall(-2.5, wallHeight / 2, 0, Math.PI / 2);
createWall( 2.5, wallHeight / 2, 0, -Math.PI / 2);

// Ceiling (if needed) – here we keep it simple and omit it per previous requests
// (You can add it later if desired.)

// -----------------------------
// 5) Load the Drawer Model
// -----------------------------
let drawer: THREE.Object3D | null = null;
const gltfLoader = new GLTFLoader();
gltfLoader.load('/models/IDANAS_drawerr.glb', (gltf) => {
  drawer = gltf.scene;
  drawer.scale.set(1, 1, 1);
  drawer.position.set(0, 0, 0);  

  drawer.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      material.roughness = 0.1; // lower roughness makes it glossier
      material.metalness = 0.8; // higher metalness can enhance the reflective look
      material.needsUpdate = true;
    }
  });

  scene.add(drawer);
  console.log("Drawer loaded!");
}, undefined, (err) => console.error('Loading error:', err));

// -----------------------------
// 6) Raycasting / Dragging Setup
// -----------------------------
const raycaster = new THREE.Raycaster();
const mouseVec = new THREE.Vector2(); // for both click and move
let isDragging = false;
let selectedObject: THREE.Object3D | null = null;
const dragOffset = new THREE.Vector3();

// We'll store the object's half dimensions (computed when dragging starts)
let halfWidth = 0;
let halfDepth = 0;

// Helper: cast a ray from a given normalized device coordinate
function intersect(pos: THREE.Vector2) {
  raycaster.setFromCamera(pos, camera);
  return raycaster.intersectObjects(scene.children, true);
}

// CLICK EVENT: pick up or drop the drawer
window.addEventListener('mousedown', (event) => {
  if (!drawer) return;

  mouseVec.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouseVec.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouseVec, camera);
  const intersects = raycaster.intersectObject(drawer, true);
  if (intersects.length > 0) {
    isDragging = true;
    selectedObject = drawer;
    
    // Compute the object's bounding box and store half dimensions (in X and Z)
    const bbox = new THREE.Box3().setFromObject(selectedObject);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    halfWidth = size.x / 2;
    halfDepth = size.z / 2;
    
    // Store the XZ offset between the object's pivot and the click intersection
    dragOffset.x = selectedObject.position.x - intersects[0].point.x;
    dragOffset.y = 0; // ignore vertical offset
    dragOffset.z = selectedObject.position.z - intersects[0].point.z;
  }
});

// MOUSEMOVE EVENT: update the mouse position
window.addEventListener('mousemove', (event) => {
  mouseVec.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouseVec.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// MOUSEUP EVENT: drop the object
window.addEventListener('mouseup', () => {
  isDragging = false;
  selectedObject = null;
});

// -----------------------------
// 7) Drag Object Function (with Clamping)
// -----------------------------
function dragObject() {
  if (!isDragging || !selectedObject) return;
  raycaster.setFromCamera(mouseVec, camera);
  const floorIntersects = raycaster.intersectObject(floor);
  if (floorIntersects.length > 0) {
    const target = floorIntersects[0].point;
    
    // Compute new position using the stored offset
    let newX = target.x + dragOffset.x;
    let newZ = target.z + dragOffset.z;
    const newY = 0; // lock Y to 0
    
    // Clamp the position so the object's bounding box stays within room boundaries:
    // Assuming the room boundaries are from -2.5 to +2.5 in both X and Z.
    newX = Math.max(-2.45 + halfWidth, Math.min(2.45 - halfWidth, newX));
    newZ = Math.max(-2.45 + halfDepth, Math.min(2.45 - halfDepth, newZ));
    
    selectedObject.position.set(newX, newY, newZ);
  }
}

// -----------------------------
// 8) Animation Loop
// -----------------------------
function animate() {
  dragObject(); // Update the position of the dragged object
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

//GLSL Shaders

// Create a box geometry
const boxGeom = new THREE.BoxGeometry(1, 1, 1);

// Define a simple vertex shader
const vertexShader = `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`;

// Define a simple fragment shader that creates a gradient
const fragmentShader = `
  varying vec2 vUv;
  uniform vec3 color1;
  uniform vec3 color2;
  
  void main() {
    // Mix color1 and color2 based on the vertical UV coordinate
    vec3 finalColor = mix(color1, color2, vUv.y);
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// Create a ShaderMaterial with the custom shaders and uniforms
const shaderMaterial = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    color1: { value: new THREE.Color(0xff0000) }, // red
    color2: { value: new THREE.Color(0x0000ff) }  // blue
  }
});
/*
// Create a mesh using the box geometry and the custom shader material
const shaderBox = new THREE.Mesh(boxGeom, shaderMaterial);
shaderBox.position.set(2, 0.5, 0); // Place it somewhere visible in the scene
scene.add(shaderBox);
*/
