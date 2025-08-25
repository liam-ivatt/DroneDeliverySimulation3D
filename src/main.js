import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Grid, AStarFinder } from "pathfinding";

// Three.js setup
let scene, camera, renderer, controls;
let container;

// City nodes and connections
const nodes = [];
const connections = [];
const nodeObjects = []; // 3D objects for nodes
const connectionObjects = []; // 3D objects for connections

// Grid parameters
const gridSize = 6;
const spacing = 4;
const startX = -10;
const startZ = -10;
let placeDepot = false;

// Pathfinding setup
let pathfindingGrid = new Grid(gridSize, gridSize);
let pathfinder = new AStarFinder();

// Vehicles and simulation state
let lorries = [];
let drones = [];
let packages = [];
let orders = [];
let orderId = 1;
let animationRunning = false;
let autoOrderInterval = null;
let depotLocation = null;

// 3D Models and materials
let materials = {};
let geometries = {};

// Animation frame ID
let animationId = null;

// Initialize Three.js scene
function initThreeJS() {
  container = document.getElementById("threejs-container");

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Sky blue

  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(15, 20, 15);
  camera.lookAt(0, 0, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.maxPolarAngle = Math.PI / 2;

  // Lighting
  setupLighting();

  // Materials and geometries
  setupMaterials();

  // Ground
  createGround();

  // Handle window resize
  window.addEventListener("resize", onWindowResize);

  // Keyboard controls
  document.addEventListener("keydown", onKeyDown);

  // Hide loading text
  document.getElementById("loading").style.display = "none";
}

function setupLighting() {
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);

  // Directional light (sun)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 50, 50);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 500;
  directionalLight.shadow.camera.left = -50;
  directionalLight.shadow.camera.right = 50;
  directionalLight.shadow.camera.top = 50;
  directionalLight.shadow.camera.bottom = -50;
  scene.add(directionalLight);
}

function setupMaterials() {
  materials = {
    road: new THREE.MeshLambertMaterial({ color: 0x666666 }),
    house: new THREE.MeshLambertMaterial({ color: 0xff6b6b }),
    depot: new THREE.MeshLambertMaterial({ color: 0x8b4513 }),
    lorry: new THREE.MeshLambertMaterial({ color: 0x888888 }),
    lorryLoaded: new THREE.MeshLambertMaterial({ color: 0xff4444 }),
    drone: new THREE.MeshLambertMaterial({ color: 0x888888 }),
    droneLoaded: new THREE.MeshLambertMaterial({ color: 0x44ff44 }),
    package: new THREE.MeshLambertMaterial({ color: 0xffd700 }),
    connection: new THREE.MeshBasicMaterial({ color: 0x333333 }),
  };

  geometries = {
    road: new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8),
    house: new THREE.BoxGeometry(0.8, 1, 0.8),
    depot: new THREE.BoxGeometry(1.2, 1.5, 1.2),
    lorry: new THREE.BoxGeometry(0.6, 0.3, 1.2),
    drone: new THREE.BoxGeometry(0.4, 0.1, 0.4),
    package: new THREE.BoxGeometry(0.2, 0.2, 0.2),
    connection: new THREE.CylinderGeometry(0.02, 0.02, 1, 8),
  };
}

function createGround() {
  const groundGeometry = new THREE.PlaneGeometry(50, 50);
  const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x90ee90 });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
}

// Generate grid nodes 
function generateNodes() {
  nodes.length = 0;
  placeDepot = false;
  let nodeId = 0;

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const x = startX + j * spacing;
      const z = startZ + i * spacing;

      // Determine node type
      let type = "road";
      if (Math.random() < 0.1 && !placeDepot) {
        placeDepot = true;
        type = "depot";
      } else if (Math.random() < 0.2) {
        type = "house";
      } else if (i === gridSize - 1 && j === gridSize - 1 && !placeDepot) {
        type = "depot";
        placeDepot = true;
      }

      nodes.push({ id: nodeId, x, y: 0, z, type });
      nodeId++;
    }
  }
}

// Generate connections
function generateConnections() {
  connections.length = 0;

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const currentNode = i * gridSize + j;
      // Connect to right neighbor
      if (j < gridSize - 1) {
        connections.push([currentNode, currentNode + 1]);
      }

      // Connect to bottom neighbor
      if (i < gridSize - 1) {
        connections.push([currentNode, currentNode + gridSize]);
      }
    }
  }
}

// Create 3D objects for nodes
function createNodeObjects() {
  // Clear existing node objects
  nodeObjects.forEach((obj) => scene.remove(obj));
  nodeObjects.length = 0;

  nodes.forEach((node) => {
    let mesh;

    if (node.type === "depot") {
      mesh = new THREE.Mesh(geometries.depot, materials.depot);
      mesh.position.set(node.x, 0.75, node.z);
    } else if (node.type === "house") {
      mesh = new THREE.Mesh(geometries.house, materials.house);
      mesh.position.set(node.x, 0.5, node.z);
    } else {
      mesh = new THREE.Mesh(geometries.road, materials.road);
      mesh.position.set(node.x, 0.05, node.z);
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    nodeObjects.push(mesh);
  });
}

// Create 3D objects for connections
function createConnectionObjects() {
  // Clear existing connection objects
  connectionObjects.forEach((obj) => scene.remove(obj));
  connectionObjects.length = 0;

  connections.forEach((conn) => {
    const nodeA = nodes[conn[0]];
    const nodeB = nodes[conn[1]];

    const dx = nodeB.x - nodeA.x;
    const dz = nodeB.z - nodeA.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    const geometry = new THREE.CylinderGeometry(0.05, 0.05, distance, 8);
    const mesh = new THREE.Mesh(geometry, materials.connection);

    // Position at midpoint
    mesh.position.set((nodeA.x + nodeB.x) / 2, 0.025, (nodeA.z + nodeB.z) / 2);

    // Rotate cylinder to lie flat and point in the right direction
    if (Math.abs(dx) > Math.abs(dz)) {
      // Horizontal connection (along X-axis)
      mesh.rotation.z = Math.PI / 2;
    } else {
      // Vertical connection (along Z-axis)
      mesh.rotation.x = Math.PI / 2;
    }

    scene.add(mesh);
    connectionObjects.push(mesh);
  });
}

// Vehicle class (adapted for 3D)
class Vehicle {
  constructor(x, z, type) {
    this.position = new THREE.Vector3(x, 0, z);
    this.type = type;
    this.speed = type === "lorry" ? 0.05 : 0.08;
    this.path = [];
    this.currentPathIndex = 0;
    this.hasPackage = false;
    this.deliveryTarget = null;
    this.state = "idle";
    this.orderId = null;

    // Create 3D mesh
    this.createMesh();
  }

  createMesh() {
    if (this.type === "lorry") {
      this.mesh = new THREE.Mesh(geometries.lorry, materials.lorry);
      this.mesh.position.y = 0.15;
    } else {
      this.mesh = new THREE.Mesh(geometries.drone, materials.drone);
      this.mesh.position.y = 2; // Drones fly higher
    }

    this.mesh.position.x = this.position.x;
    this.mesh.position.z = this.position.z;
    this.mesh.castShadow = true;
    scene.add(this.mesh);
  }

  updateMesh() {
    this.mesh.position.x = this.position.x;
    this.mesh.position.z = this.position.z;

    // Update material based on if loaded or not
    if (this.type === "lorry") {
      this.mesh.material = this.hasPackage
        ? materials.lorryLoaded
        : materials.lorry;
    } else {
      this.mesh.material = this.hasPackage
        ? materials.droneLoaded
        : materials.drone;
    }
  }

  moveTowards(targetX, targetZ) {
    const dx = targetX - this.position.x;
    const dz = targetZ - this.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance > this.speed) {
      this.position.x += (dx / distance) * this.speed;
      this.position.z += (dz / distance) * this.speed;
      this.updateMesh();
      return false;
    } else {
      this.position.x = targetX;
      this.position.z = targetZ;
      this.updateMesh();
      return true;
    }
  }

  update() {
    if (this.path.length > 0 && this.currentPathIndex < this.path.length) {
      const target = this.path[this.currentPathIndex];
      const reached = this.moveTowards(target.x, target.z);

      if (reached) {
        this.currentPathIndex++;
        if (this.currentPathIndex >= this.path.length) {
          this.onPathComplete();
        }
      }
    }
  }

  onPathComplete() {
    if (this.type === "lorry") {
      if (
        this.hasPackage &&
        this.position.x === depotLocation.x &&
        this.position.z === depotLocation.z
      ) {
        // Lorry delivered package to depot
        this.state = "idle";
        this.hasPackage = false;
        this.createPackageAtDepot();
        this.orderId = null;

        const path = findPath(depotLocation, nodes[0]);
        this.setPath(path);

        setTimeout(() => {
          assignDroneToPackage();
        }, 500);
      } else if (
        !this.hasPackage &&
        this.position.x === nodes[0].x &&
        this.position.z === nodes[0].z
      ) {
        // Lorry returned to start
        this.state = "idle";
        setTimeout(() => {
          this.pickupNextOrder();
        }, 1000);
      }
    } else if (this.type === "drone") {
      if (this.hasPackage && this.deliveryTarget) {
        // Drone delivered package to house
        this.hasPackage = false;
        const order = orders.find((o) => o.id === this.orderId);
        if (order) {
          order.delivered = true;
        }
        this.deliveryTarget = null;
        this.orderId = null;
        this.state = "returning";

        setTimeout(() => {
          this.setPath([depotLocation]);
        }, 1000);
      } else if (
        !this.hasPackage &&
        this.position.x === depotLocation.x &&
        this.position.z === depotLocation.z
      ) {
        // Drone returned to depot
        this.state = "idle";
        setTimeout(() => {
          assignDroneToPackage();
        }, 1000);
      }
    }

    this.updateMesh();
  }

  createPackageAtDepot() {
    const packageMesh = new THREE.Mesh(geometries.package, materials.package);
    packageMesh.position.set(
      depotLocation.x + (Math.random() - 0.5) * 2,
      0.1,
      depotLocation.z + (Math.random() - 0.5) * 2
    );
    packageMesh.castShadow = true;

    packages.push({
      mesh: packageMesh,
      orderId: this.orderId,
      position: packageMesh.position.clone(),
    });

    scene.add(packageMesh);
  }

  setPath(nodePath) {
    this.path = Array.isArray(nodePath) ? nodePath : [nodePath];
    this.currentPathIndex = 0;
    this.state = "moving";
  }

  pickupNextOrder() {
    const pendingOrder = orders.find((o) => !o.assigned && !o.delivered);
    if (pendingOrder && this.type === "lorry" && !this.hasPackage) {
      pendingOrder.assigned = true;
      this.hasPackage = true;
      this.orderId = pendingOrder.id;

      // Find path from current position to depot
      const currentNode =
        findNodeByPosition(this.position.x, this.position.z) || nodes[0];
      const path = findPath(currentNode, depotLocation);

      if (path && path.length > 0) {
        this.setPath(path);
        logAction(
          `Lorry picked up order ${pendingOrder.id} for house ${pendingOrder.houseId}`
        );
      } else {
        // if pathfinding fails
        this.setPath([nodes[0], depotLocation]);
        logAction(`Lorry picked up order ${pendingOrder.id} (direct route)`);
      }
    }
  }

  pickupPackage(packageIndex, order) {
    if (this.type === "drone" && !this.hasPackage) {
      this.hasPackage = true;
      this.orderId = order.id;
      const houseNode = nodes.find( 
        (n) => n.type === "house" && n.id === order.houseId
      );
      this.deliveryTarget = houseNode;
      this.setPath([houseNode]);

      // Remove package from scene and array
      scene.remove(packages[packageIndex].mesh);
      packages.splice(packageIndex, 1);

      logAction(`Drone picked up package for order ${order.id}`);
    }
  }

  destroy() {
    if (this.mesh) {
      scene.remove(this.mesh);
    }
  }
}

// Order class (same as 2D)
class Order {
  constructor(houseId) {
    this.id = orderId++;
    this.houseId = houseId;
    this.delivered = false;
    this.assigned = false;
  }
}

// Pathfinding helper functions
function worldToGrid(worldX, worldZ) {
  // Convert world coordinates to grid coordinates
  const gridX = Math.round((worldX - startX) / spacing);
  const gridZ = Math.round((worldZ - startZ) / spacing);
  return { x: gridX, z: gridZ };
}

function gridToWorld(gridX, gridZ) {
  // Convert grid coordinates to world coordinates
  const worldX = startX + gridX * spacing;
  const worldZ = startZ + gridZ * spacing;
  return { x: worldX, z: worldZ };
}

function findNodeByPosition(x, z) {
  // Find node by world coordinates
  return nodes.find(
    (node) => Math.abs(node.x - x) < 0.1 && Math.abs(node.z - z) < 0.1
  );
}

function findPath(startNode, endNode) {
  // Convert nodes to grid coordinates
  const startGrid = worldToGrid(startNode.x, startNode.z);
  const endGrid = worldToGrid(endNode.x, endNode.z);

  // Clone the grid for pathfinding
  const gridClone = pathfindingGrid.clone();

  // Find path in grid coordinates
  const gridPath = pathfinder.findPath(
    startGrid.x,
    startGrid.z,
    endGrid.x,
    endGrid.z,
    gridClone
  );

  // Convert path back to world coordinates
  const worldPath = gridPath.map(([gridX, gridZ]) => {
    const worldPos = gridToWorld(gridX, gridZ);
    return { x: worldPos.x, z: worldPos.z };
  });

  return worldPath;
}

// Utility functions
function assignDroneToPackage() {
  const availableDrone = drones.find(
    (d) => d.state === "idle" && !d.hasPackage
  );
  const availablePackage = packages.find((p) => p);

  if (availableDrone && availablePackage) {
    const order = orders.find((o) => o.id === availablePackage.orderId);
    if (order && !order.delivered) {
      const packageIndex = packages.indexOf(availablePackage);
      availableDrone.pickupPackage(packageIndex, order);
    }
  }
}

function placeOrder() {
  const houses = nodes.filter((n) => n.type === "house");

  if (houses.length === 0) {
    alert("No houses available to place an order.");
    return;
  }

  const randomHouse = houses[Math.floor(Math.random() * houses.length)];
  const order = new Order(randomHouse.id);
  orders.push(order);

  logAction(`Order placed for house ${randomHouse.id} (Order ID: ${order.id})`);
}

function startAutoOrders() {
  autoOrderInterval = setInterval(() => {
    if (Math.random() < 0.5) {
      placeOrder();
    }
  }, 4000);
}

function stopAutoOrders() {
  if (autoOrderInterval) {
    clearInterval(autoOrderInterval);
    autoOrderInterval = null;
  }
}

function logAction(message) {
  const logBox = document.getElementById("actionLog");
  const timestamp = new Date().toLocaleTimeString();
  logBox.innerHTML += `<div>[${timestamp}] ${message}</div>`;
  logBox.scrollTop = logBox.scrollHeight;
}

function updateOrderQueue() {
  const queueElement = document.getElementById("orderQueue");
  const pendingOrders = orders.filter((o) => !o.delivered);
  const content = pendingOrders
    .map((order) => {
      const status = order.assigned ? "In Progress" : "Waiting";
      return `<div>Order #${order.id} - House at node ${order.houseId}: ${status}</div>`;
    })
    .join("");

  queueElement.innerHTML = content || "<div>No active orders</div>";
}

function updateStats() {
  document.getElementById("totalOrders").textContent = orders.length;
  document.getElementById("deliveredOrders").textContent = orders.filter(
    (o) => o.delivered
  ).length;
  document.getElementById("activeVehicles").textContent =
    lorries.length + drones.length;
  document.getElementById("packagesInTransit").textContent = packages.length;
}

// Animation loop
function animate() {
  if (!animationRunning) return;

  // Update controls
  controls.update();

  // Update vehicles
  lorries.forEach((lorry) => lorry.update());
  drones.forEach((drone) => drone.update());

  // Assign lorries to pending orders
  lorries.forEach((lorry) => {
    if (lorry.state === "idle" && !lorry.hasPackage) {
      lorry.pickupNextOrder();
    }
  });

  // Update UI
  updateOrderQueue();
  updateStats();

  // Render
  renderer.render(scene, camera);

  animationId = requestAnimationFrame(animate);
}

// Main simulation functions
function startSimulation() {
  if (animationRunning) return;

  animationRunning = true;

  // Reset everything
  resetVehicles();
  packages.forEach((pkg) => scene.remove(pkg.mesh));
  packages.length = 0;
  orders.length = 0;
  orderId = 1;

  // Generate world
  generateNodes();
  generateConnections();
  createNodeObjects();
  createConnectionObjects();

  depotLocation = nodes.find((n) => n.type === "depot");

  // Create vehicles
  const lorry = new Vehicle(nodes[0].x, nodes[0].z, "lorry");
  lorries.push(lorry);

  const drone = new Vehicle(depotLocation.x, depotLocation.z, "drone");
  drones.push(drone);

  // Start simulation
  setTimeout(() => {
    placeOrder();
  }, 1000);

  startAutoOrders();
  animate();

  logAction("Simulation started");
}

function resetSimulation() {
  animationRunning = false;
  stopAutoOrders();

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  // Clear everything
  resetVehicles();
  packages.forEach((pkg) => scene.remove(pkg.mesh));
  packages.length = 0;
  orders.length = 0;

  // Clear UI
  document.getElementById("actionLog").innerHTML = "";
  updateOrderQueue();
  updateStats();

  logAction("Simulation reset");
}

function resetVehicles() {
  lorries.forEach((lorry) => lorry.destroy());
  drones.forEach((drone) => drone.destroy());
  lorries.length = 0;
  drones.length = 0;
}

// Event handlers
function onWindowResize() {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function onKeyDown(event) {
  if (event.code === "Space") {
    event.preventDefault();
    // Reset camera position
    camera.position.set(15, 20, 15);
    camera.lookAt(0, 0, 0);
    controls.reset();
  }
}

// Make functions globally available
window.startSimulation = startSimulation;
window.resetSimulation = resetSimulation;
window.placeOrder = placeOrder;

// Initialize when page loads
document.addEventListener("DOMContentLoaded", () => {
  initThreeJS();

  // Initial setup
  generateNodes();
  generateConnections();
  createNodeObjects();
  createConnectionObjects();

  // Start render loop for camera controls
  function renderLoop() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(renderLoop);
  }
  renderLoop();
});
