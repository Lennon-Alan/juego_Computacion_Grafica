import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/addons/controls/OrbitControls';
import { DeviceOrientationControls } from 'three/examples/jsm/addons/controls/DeviceOrientationControls';
import { GLTFLoader } from 'three/examples/jsm/addons/loaders/GLTFLoader';

// Variables globales
let scene, camera, renderer, controls, deviceControls;
let player, mixer, idleAction, walkAction, activeAction;
let mazeBlocks = [];
let enemies = [];
let fireballs = [];
let goalMarker;
let score = 0;
let level = 1;
let lives = 5;
let gameWon = false;
let gameOver = false;
let thirdPerson = true;
let timer = 0;
let timeLimit = 60;
let timerInterval;
let isPaused = true;
let mazeGrid;
let mouseSensitivity = 0.005;
let isLeftMousePressed = false;

// Variables para cámara
let cameraDistance = 20;
let firstPersonCameraDistance = 3;
const minCameraDistance = 5;
const maxCameraDistance = 50;
const minFirstPersonCameraDistance = 1;
const maxFirstPersonCameraDistance = 5;
const cameraHeight = 15;
const firstPersonCameraHeight = 2.5;
let firstPersonCameraYaw = 0;
let isTransitioning = false;
let transitionProgress = 0;
let startPosition = new THREE.Vector3();
let targetPosition = new THREE.Vector3();
let startQuaternion = new THREE.Quaternion();
let targetQuaternion = new THREE.Quaternion();

// Configuración del laberinto
let mazeWidth = 15;
let mazeHeight = 15;
const playerStartPos = { x: 1, z: 1 };
let goalPos = { x: mazeWidth - 2, z: mazeHeight - 2 };
const blockSize = 2;

// Variables para controles táctiles
let joystickActive = false;
let joystickStart = { x: 0, y: 0 };
let joystickDirection = new THREE.Vector2();
const joystickWrapper = document.getElementById('joystickWrapper');
const joystickHandle = document.getElementById('joystickHandle');
const fireButton = document.getElementById('fireButton');
const orientationToggle = document.getElementById('orientationToggle');
let useDeviceOrientation = false;

// Sistema de manejo de pantallas unificado
function showScreen(screenId) {
    console.log('Mostrando pantalla:', screenId);
    const screens = ['mainMenu', 'instructionsScreen', 'levelSelectScreen', 'winScreen', 'gameOverScreen', 'settingsScreen', 'creditsScreen'];
    
    screens.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.remove('active');
        }
    });
    
    if (screenId && screenId !== 'none') {
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }
        
        if (screenId === 'instructionsScreen') {
            updateInstructionsInfo();
        }
    }
}

// Hacer la función global para compatibilidad
window.showScreen = showScreen;

// Función para actualizar información en la pantalla de instrucciones
function updateInstructionsInfo() {
    const scoreEl = document.getElementById('score');
    const levelEl = document.getElementById('level');
    const livesEl = document.getElementById('lives');
    const timerEl = document.getElementById('timer');
    const statusEl = document.getElementById('status');
    
    if (scoreEl) document.getElementById('infoScore').textContent = scoreEl.textContent.replace('Puntaje: ', '');
    if (levelEl) document.getElementById('infoLevel').textContent = levelEl.textContent.replace('Nivel: ', '');
    if (livesEl) document.getElementById('infoLives').textContent = livesEl.textContent.replace('Vidas: ', '');
    if (timerEl) document.getElementById('infoTimer').textContent = timerEl.textContent.replace('Tiempo: ', '');
    if (statusEl) document.getElementById('infoStatus').textContent = statusEl.textContent;
}

// Función para selección de nivel
function selectLevel(selectedLevel) {
    console.log('Nivel seleccionado:', selectedLevel);
    level = Math.min(selectedLevel, 5);
    updateLevelParameters();
    showScreen('none');
    isPaused = false;
    renderer.domElement.style.filter = 'none';
    resetGame();
}

// Hacer la función global
window.selectLevel = selectLevel;

// Inicialización de la escena
function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 15, 60);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 15, cameraDistance);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    renderer.domElement.style.filter = 'blur(5px)';
    renderer.domElement.style.zIndex = '0';

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI * 0.75;
    controls.minPolarAngle = Math.PI * 0.1;
    controls.maxAzimuthAngle = Math.PI * 0.5;
    controls.minAzimuthAngle = -Math.PI * 0.5;
    controls.enableZoom = false;

    // Inicializar DeviceOrientationControls
    deviceControls = new DeviceOrientationControls(camera);
    deviceControls.enabled = false;
}

// Luces
function setupLights() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30;
    dirLight.shadow.camera.bottom = -30;
    scene.add(dirLight);
}

// Suelo
function createGround() {
    const texLoader = new THREE.TextureLoader();
    const grass = texLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
    grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
    grass.repeat.set(10, 10);
    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(60 + (level - 1) * 10, 60 + (level - 1) * 10),
        new THREE.MeshStandardMaterial({ map: grass })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    scene.add(plane);
}

// Generación del laberinto
function generateMaze(w, h) {
    mazeGrid = Array.from({ length: h }, () => Array(w).fill(1));
    function carve(x, y) {
        mazeGrid[y][x] = 0;
        const dirs = [[0, -2], [2, 0], [0, 2], [-2, 0]].sort(() => Math.random() - 0.5);
        for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (ny >= 0 && ny < h && nx >= 0 && nx < w && mazeGrid[ny][nx] === 1) {
                mazeGrid[y + dy / 2][x + dx / 2] = 0;
                carve(nx, ny);
            }
        }
    }
    carve(playerStartPos.x, playerStartPos.z);
    mazeGrid[playerStartPos.z][playerStartPos.x] = 0;
    mazeGrid[goalPos.z][goalPos.x] = 0;
    if (mazeGrid[goalPos.z][goalPos.x] === 1) {
        mazeGrid[goalPos.z][goalPos.x] = 0;
        mazeGrid[goalPos.z - 1][goalPos.x] = 0;
    }

    if (level === 5) {
        for (let z = 0; z < h; z++) {
            for (let x = 0; x < w; x++) {
                if (mazeGrid[z][x] === 0 && Math.random() < 0.05 && !(x === playerStartPos.x && z === playerStartPos.z) && !(x === goalPos.x && z === goalPos.z)) {
                    mazeGrid[z][x] = 1;
                }
            }
        }
    }

    function ensurePath(startX, startZ, goalX, goalZ) {
        const queue = [{ x: startX, z: startZ, path: [] }];
        const visited = new Set();
        const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];

        while (queue.length > 0) {
            const { x, z, path } = queue.shift();
            const key = `${x},${z}`;
            if (visited.has(key)) continue;
            visited.add(key);

            if (x === goalX && z === goalZ) {
                return true;
            }

            for (const [dx, dz] of directions) {
                const nx = x + dx;
                const nz = z + dz;
                if (nx >= 0 && nx < w && nz >= 0 && nz < h && mazeGrid[nz][nx] === 0 && !visited.has(`${nx},${nz}`)) {
                    queue.push({ x: nx, z: nz, path: [...path, { x: nx, z: nz }] });
                }
            }
        }

        if (!visited.has(`${goalX},${goalZ}`)) {
            for (let z = 0; z < h; z++) {
                for (let x = 0; x < w; x++) {
                    if (mazeGrid[z][x] === 1 && Math.random() < 0.5) {
                        mazeGrid[z][x] = 0;
                        if (ensurePath(playerStartPos.x, playerStartPos.z, goalPos.x, goalPos.z)) {
                            return true;
                        }
                        mazeGrid[z][x] = 1;
                    }
                }
            }
            mazeGrid[goalPos.z][goalPos.x] = 0;
            if (!ensurePath(playerStartPos.x, playerStartPos.z, goalPos.x, goalPos.z)) {
                console.warn('No se pudo garantizar un camino; forzando conexión directa.');
                mazeGrid[(startZ + goalZ) / 2][(startX + goalX) / 2] = 0;
            }
        }
        return true;
    }

    ensurePath(playerStartPos.x, playerStartPos.z, goalPos.x, goalPos.z);
    return mazeGrid;
}

// Crear laberinto
function createMaze() {
    mazeBlocks.forEach(block => scene.remove(block));
    mazeBlocks = [];
    const maze = generateMaze(mazeWidth, mazeHeight);
    maze.forEach((row, z) => {
        row.forEach((cell, x) => {
            if (cell === 1) {
                const height = level === 5 ? 2 : Math.floor(Math.random() * (3 + level)) + 2;
                for (let h = 0; h < height; h++) {
                    const block = new THREE.Mesh(
                        new THREE.BoxGeometry(blockSize, 2, blockSize),
                        new THREE.MeshStandardMaterial({
                            color: new THREE.Color().setHSL(0.6, 0.3, 0.3 + Math.random() * 0.2)
                        })
                    );
                    block.position.set(
                        x * blockSize - (mazeWidth * blockSize) / 2,
                        1 + h * 2,
                        z * blockSize - (mazeHeight * blockSize) / 2
                    );
                    block.castShadow = true;
                    scene.add(block);
                    mazeBlocks.push(block);
                }
            }
        });
    });
}

// Crear meta
function createGoal() {
    if (goalMarker) scene.remove(goalMarker);
    const goalGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const goalMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x330000 });
    goalMarker = new THREE.Mesh(goalGeo, goalMat);
    goalMarker.position.set(
        goalPos.x * blockSize - (mazeWidth * blockSize) / 2,
        0.75,
        goalPos.z * blockSize - (mazeHeight * blockSize) / 2
    );
    goalMarker.castShadow = true;
    scene.add(goalMarker);
    const animate = () => {
        if (goalMarker) {
            goalMarker.rotation.y += 0.02;
            goalMarker.position.y = 0.75 + Math.sin(Date.now() * 0.005) * 0.3;
        }
        requestAnimationFrame(animate);
    };
    animate();
}

// Crear enemigos
function createEnemies() {
    enemies.forEach(enemy => scene.remove(enemy.mesh));
    enemies = [];
    const enemyCount = level === 5 ? 8 : Math.floor(level * 2 + 2);
    const enemyGeo = new THREE.ConeGeometry(0.8, 1.6, 16);
    const enemyMat = new THREE.MeshStandardMaterial({ 
        color: 0x0000ff, 
        emissive: 0x000033,
        metalness: 0.5,
        roughness: 0.3
    });
    const freeCells = [];
    mazeGrid.forEach((row, z) => {
        row.forEach((cell, x) => {
            if (cell === 0 && !(x === playerStartPos.x && z === playerStartPos.z) && !(x === goalPos.x && z === goalPos.z)) {
                freeCells.push({ x, z });
            }
        });
    });
    freeCells.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(enemyCount, freeCells.length); i++) {
        const { x, z } = freeCells[i];
        const enemy = new THREE.Mesh(enemyGeo, enemyMat);
        const startX = x * blockSize - (mazeWidth * blockSize) / 2;
        const startZ = z * blockSize - (mazeHeight * blockSize) / 2;
        enemy.position.set(startX, 0.8, startZ);
        enemy.rotation.x = Math.PI / 2;
        enemy.castShadow = true;
        scene.add(enemy);
        const directions = [
            new THREE.Vector3(0.5, 0, 0),
            new THREE.Vector3(-0.5, 0, 0),
            new THREE.Vector3(0, 0, 0.5),
            new THREE.Vector3(0, 0, -0.5)
        ];
        const initialVelocity = directions[Math.floor(Math.random() * directions.length)];
        enemies.push({
            mesh: enemy,
            velocity: initialVelocity,
            startX: startX,
            startZ: startZ,
            minX: startX - blockSize * 2,
            maxX: startX + blockSize * 2,
            minZ: startZ - blockSize * 2,
            maxZ: startZ + blockSize * 2,
            direction: initialVelocity.clone().normalize(),
            path: [],
            lastPathUpdate: 0
        });
    }
}

// Verificar línea de visión
function hasLineOfSight(enemy, player) {
    const raycaster = new THREE.Raycaster();
    const toPlayer = new THREE.Vector3().subVectors(player.position, enemy.mesh.position).normalize();
    raycaster.set(enemy.mesh.position, toPlayer);
    const intersects = raycaster.intersectObjects(mazeBlocks);
    return intersects.length === 0 || intersects[0].distance > enemy.mesh.position.distanceTo(player.position);
}

// Algoritmo A* simplificado
function findPathToPlayer(enemy, player) {
    const start = {
        x: Math.round((enemy.mesh.position.x + (mazeWidth * blockSize) / 2) / blockSize),
        z: Math.round((enemy.mesh.position.z + (mazeHeight * blockSize) / 2) / blockSize)
    };
    const goal = {
        x: Math.round((player.position.x + (mazeWidth * blockSize) / 2) / blockSize),
        z: Math.round((player.position.z + (mazeHeight * blockSize) / 2) / blockSize)
    };

    const openList = [{ x: start.x, z: start.z, g: 0, h: 0, f: 0, parent: null }];
    const closedList = new Set();
    const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    let nodeCount = 0;

    while (openList.length > 0 && nodeCount < 200) {
        openList.sort((a, b) => a.f - b.f);
        const current = openList.shift();
        const currentKey = `${current.x},${current.z}`;
        closedList.add(currentKey);
        nodeCount++;

        if (current.x === goal.x && current.z === goal.z) {
            const path = [];
            let node = current;
            while (node.parent) {
                path.push(node);
                node = node.parent;
            }
            return path.reverse();
        }

        for (const [dx, dz] of directions) {
            const nx = current.x + dx;
            const nz = current.z + dz;
            const key = `${nx},${nz}`;
            if (nx >= 0 && nx < mazeWidth && nz >= 0 && nz < mazeHeight && !closedList.has(key) && mazeGrid[nz][nx] === 0) {
                const g = current.g + 1;
                const h = Math.abs(nx - goal.x) + Math.abs(nz - goal.z);
                const f = g + h;
                openList.push({ x: nx, z: nz, g, h, f, parent: current });
            }
        }
    }
    return [];
}

// Mover enemigos
function moveEnemies(delta) {
    const enemySpeed = level === 5 ? 0.8 : 0.5 + level * 0.1;
    const detectionAngle = level >= 5 ? Math.PI / 2 : level >= 3 ? Math.PI / 2 : Math.PI / 4;

    enemies.forEach(enemy => {
        let nextPos;
        if (level >= 5) {
            enemy.lastPathUpdate += delta;
            if ((enemy.path.length === 0 || enemy.lastPathUpdate > 1.0) && Math.random() < 0.1) {
                enemy.path = findPathToPlayer(enemy, player);
                enemy.lastPathUpdate = 0;
            }
            if (enemy.path.length > 0) {
                const nextNode = enemy.path[0];
                const targetPos = new THREE.Vector3(
                    nextNode.x * blockSize - (mazeWidth * blockSize) / 2,
                    0.8,
                    nextNode.z * blockSize - (mazeHeight * blockSize) / 2
                );
                enemy.velocity = targetPos.clone().sub(enemy.mesh.position).normalize().multiplyScalar(enemySpeed);
                nextPos = enemy.mesh.position.clone().add(enemy.velocity.clone().multiplyScalar(delta));
                if (enemy.mesh.position.distanceTo(targetPos) < 0.5) {
                    enemy.path.shift();
                }
            } else {
                nextPos = enemy.mesh.position.clone().add(enemy.velocity.clone().multiplyScalar(delta));
            }
        } else {
            nextPos = enemy.mesh.position.clone().add(enemy.velocity.clone().multiplyScalar(delta * enemySpeed));
        }

        let hitBoundary = false;
        let possibleDirections = [];

        const isXMovement = Math.abs(enemy.velocity.x) > Math.abs(enemy.velocity.z);
        if (isXMovement) {
            if (nextPos.x > enemy.maxX) {
                nextPos.x = enemy.maxX;
                hitBoundary = true;
                possibleDirections = [
                    new THREE.Vector3(-0.5, 0, 0),
                    new THREE.Vector3(0.5, 0, 0)
                ];
            } else if (nextPos.x < enemy.minX) {
                nextPos.x = enemy.minX;
                hitBoundary = true;
                possibleDirections = [
                    new THREE.Vector3(0.5, 0, 0),
                    new THREE.Vector3(-0.5, 0, 0)
                ];
            }
        } else {
            if (nextPos.z > enemy.maxZ) {
                nextPos.z = enemy.maxZ;
                hitBoundary = true;
                possibleDirections = [
                    new THREE.Vector3(0, 0, -0.5),
                    new THREE.Vector3(0, 0, 0.5)
                ];
            } else if (nextPos.z < enemy.minZ) {
                nextPos.z = enemy.minZ;
                hitBoundary = true;
                possibleDirections = [
                    new THREE.Vector3(0, 0, 0.5),
                    new THREE.Vector3(0, 0, -0.5)
                ];
            }
        }

        if (!hitBoundary && detectCollision(nextPos)) {
            hitBoundary = true;
            possibleDirections = isXMovement
                ? [new THREE.Vector3(-enemy.velocity.x, 0, 0)]
                : [new THREE.Vector3(0, 0, -enemy.velocity.z)];
        }

        if (!hitBoundary) {
            enemy.mesh.position.copy(nextPos);
        }

        const angle = Math.atan2(enemy.velocity.z, enemy.velocity.x);
        enemy.mesh.rotation.z = angle - Math.PI / 2;

        if (level >= 3 && player && !hitBoundary) {
            const toPlayer = new THREE.Vector3().subVectors(player.position, enemy.mesh.position).normalize();
            const dot = toPlayer.dot(enemy.velocity.normalize());
            if (dot > Math.cos(detectionAngle) && hasLineOfSight(enemy, player)) {
                enemy.velocity.copy(toPlayer.multiplyScalar(enemySpeed));
                enemy.mesh.material.color.set(0xff0000);
            } else {
                enemy.mesh.material.color.set(0x0000ff);
            }
        }

        if (hitBoundary && player && level < 5) {
            let chosenDirection = null;
            const toPlayer = new THREE.Vector3().subVectors(player.position, enemy.mesh.position).normalize();
            for (const dir of possibleDirections) {
                const dot = toPlayer.dot(dir.normalize());
                if (dot > Math.cos(detectionAngle) && hasLineOfSight(enemy, player)) {
                    chosenDirection = dir;
                    enemy.mesh.material.color.set(0xff0000);
                    break;
                }
            }
            if (!chosenDirection) {
                chosenDirection = possibleDirections[Math.floor(Math.random() * possibleDirections.length)];
                enemy.mesh.material.color.set(0x0000ff);
            }
            enemy.velocity.copy(chosenDirection.multiplyScalar(enemySpeed));
            if (Math.abs(chosenDirection.x) > 0) {
                enemy.minX = enemy.mesh.position.x - blockSize * 2;
                enemy.maxX = enemy.mesh.position.x + blockSize * 2;
                enemy.minZ = enemy.startZ;
                enemy.maxZ = enemy.startZ;
            } else {
                enemy.minX = enemy.startX;
                enemy.maxX = enemy.startX;
                enemy.minZ = enemy.mesh.position.z - blockSize * 2;
                enemy.maxZ = enemy.mesh.position.z + blockSize * 2;
            }
        }
    });
}

// Disparar bola de fuego
function shootFireball() {
    const fireballGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const fireballMat = new THREE.MeshStandardMaterial({ color: 0xff4500, emissive: 0xff4500 });
    const fireball = new THREE.Mesh(fireballGeo, fireballMat);
    const offset = new THREE.Vector3(0, 0.5, 0.5).applyQuaternion(player.quaternion);
    fireball.position.copy(player.position).add(offset);
    fireball.castShadow = true;
    const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(player.quaternion);
    fireball.userData = {
        velocity: direction.multiplyScalar(10),
        lifetime: 2
    };
    scene.add(fireball);
    fireballs.push(fireball);
}

// Actualizar bolas de fuego
function updateFireballs(delta) {
    fireballs = fireballs.filter(fireball => {
        fireball.userData.lifetime -= delta;
        if (fireball.userData.lifetime <= 0) {
            scene.remove(fireball);
            return false;
        }
        const nextPos = fireball.position.clone().add(fireball.userData.velocity.clone().multiplyScalar(delta));
        if (detectCollision(nextPos)) {
            scene.remove(fireball);
            return false;
        }
        let hitEnemy = false;
        enemies = enemies.filter(enemy => {
            if (fireball.position.distanceTo(enemy.mesh.position) < 1.5) {
                scene.remove(enemy.mesh);
                return false;
            }
            return true;
        });
        if (hitEnemy) {
            scene.remove(fireball);
            return false;
        }
        fireball.position.copy(nextPos);
        return true;
    });
}

// Cargar jugador
function loadPlayer() {
    const loader = new GLTFLoader();
    loader.load(
        'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Fox/glTF-Binary/Fox.glb',
        (gltf) => {
            if (player) scene.remove(player);
            player = gltf.scene;
            player.scale.set(0.03, 0.03, 0.03);
            player.position.set(
                playerStartPos.x * blockSize - (mazeWidth * blockSize) / 2,
                0,
                playerStartPos.z * blockSize - (mazeHeight * blockSize) / 2
            );
            player.traverse(child => {
                if (child.isMesh) child.castShadow = true;
            });
            scene.add(player);
            mixer = new THREE.AnimationMixer(player);
            const clips = gltf.animations;
            idleAction = mixer.clipAction(clips.find(c => c.name === 'Survey'));
            walkAction = mixer.clipAction(clips.find(c => c.name === 'Walk'));
            activeAction = idleAction;
            idleAction?.play();
            // Asegurar la posición inicial de la cámara en nivel 5
            if (level === 5) {
                thirdPerson = false;
                controls.enabled = false;
                deviceControls.enabled = useDeviceOrientation;
                const offset = new THREE.Vector3(
                    Math.sin(firstPersonCameraYaw) * firstPersonCameraDistance,
                    firstPersonCameraHeight,
                    Math.cos(firstPersonCameraYaw) * firstPersonCameraDistance
                );
                camera.position.copy(player.position).add(offset);
                const lookAtPoint = new THREE.Vector3(
                    player.position.x - Math.sin(firstPersonCameraYaw) * 5,
                    player.position.y,
                    player.position.z - Math.cos(firstPersonCameraYaw) * 5
                );
                camera.lookAt(lookAtPoint);
            }
        },
        undefined,
        err => console.error('Error al cargar modelo:', err)
    );
}

// Detección de colisiones optimizada
function detectCollision(pos) {
    const gridX = Math.round((pos.x + (mazeWidth * blockSize) / 2) / blockSize);
    const gridZ = Math.round((pos.z + (mazeHeight * blockSize) / 2) / blockSize);
    if (gridX >= 0 && gridX < mazeWidth && gridZ >= 0 && gridZ < mazeHeight) {
        if (mazeGrid[gridZ][gridX] === 1) {
            return true;
        }
    }
    const worldLimit = (mazeWidth * blockSize) / 2 + 5;
    if (Math.abs(pos.x) > worldLimit || Math.abs(pos.z) > worldLimit) {
        return true;
    }
    return false;
}

// Controles táctiles (Joystick)
function setupTouchControls() {
    joystickWrapper.addEventListener('touchstart', (e) => {
        if (!isPaused) {
            e.preventDefault();
            joystickActive = true;
            const touch = e.touches[0];
            joystickStart.x = touch.clientX;
            joystickStart.y = touch.clientY;
            joystickHandle.style.left = '30px';
            joystickHandle.style.top = '30px';
        }
    });

    joystickWrapper.addEventListener('touchmove', (e) => {
        if (joystickActive && !isPaused) {
            e.preventDefault();
            const touch = e.touches[0];
            const deltaX = touch.clientX - joystickStart.x;
            const deltaY = touch.clientY - joystickStart.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const maxDistance = 30; // Radio del joystick
            const clampedDistance = Math.min(distance, maxDistance);
            const angle = Math.atan2(deltaY, deltaX);
            joystickDirection.set(
                (clampedDistance / maxDistance) * Math.cos(angle),
                -(clampedDistance / maxDistance) * Math.sin(angle)
            );
            joystickHandle.style.left = `${30 + (clampedDistance / maxDistance) * deltaX / distance * maxDistance}px`;
            joystickHandle.style.top = `${30 + (clampedDistance / maxDistance) * deltaY / distance * maxDistance}px`;
        }
    });

    joystickWrapper.addEventListener('touchend', () => {
        joystickActive = false;
        joystickDirection.set(0, 0);
        joystickHandle.style.left = '30px';
        joystickHandle.style.top = '30px';
    });

    fireButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!isPaused) {
            shootFireball();
        }
    });

    orientationToggle.addEventListener('click', () => {
        if (!thirdPerson && !isPaused) {
            useDeviceOrientation = !useDeviceOrientation;
            deviceControls.enabled = useDeviceOrientation;
            orientationToggle.textContent = useDeviceOrientation ? 'Desactivar Orientación' : 'Activar Orientación';
            if (useDeviceOrientation) {
                deviceControls.connect();
            } else {
                deviceControls.disconnect();
                // Restaurar orientación inicial
                const offset = new THREE.Vector3(
                    Math.sin(firstPersonCameraYaw) * firstPersonCameraDistance,
                    firstPersonCameraHeight,
                    Math.cos(firstPersonCameraYaw) * firstPersonCameraDistance
                );
                camera.position.copy(player.position).add(offset);
                const lookAtPoint = new THREE.Vector3(
                    player.position.x - Math.sin(firstPersonCameraYaw) * 5,
                    player.position.y,
                    player.position.z - Math.cos(firstPersonCameraYaw) * 5
                );
                camera.lookAt(lookAtPoint);
            }
        }
    });

    // Manejo de zoom con gestos
    let initialDistance = null;
    document.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            initialDistance = Math.sqrt(dx * dx + dy * dy);
        }
    });

    document.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const currentDistance = Math.sqrt(dx * dx + dy * dy);
            if (initialDistance !== null) {
                const delta = currentDistance - initialDistance;
                if (thirdPerson) {
                    cameraDistance += delta * 0.05;
                    cameraDistance = Math.max(minCameraDistance, Math.min(maxCameraDistance, cameraDistance));
                } else {
                    firstPersonCameraDistance += delta * 0.05;
                    firstPersonCameraDistance = Math.max(minFirstPersonCameraDistance, Math.min(maxFirstPersonCameraDistance, firstPersonCameraDistance));
                }
            }
            initialDistance = currentDistance;
        }
    });

    document.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            initialDistance = null;
        }
    });
}

// Controles de mouse (para compatibilidad en modo móvil si se usa un mouse)
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'f' && !isPaused) {
        shootFireball();
    }
});
window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
});
window.addEventListener('mousedown', e => {
    if (e.button === 0) {
        isLeftMousePressed = true;
    }
});
window.addEventListener('mouseup', e => {
    if (e.button === 0) {
        isLeftMousePressed = false;
    }
});
window.addEventListener('mousemove', e => {
    if (!thirdPerson && !isPaused && isLeftMousePressed) {
        firstPersonCameraYaw -= e.movementX * mouseSensitivity;
    }
});
window.addEventListener('wheel', e => {
    e.preventDefault();
    if (thirdPerson) {
        cameraDistance += e.deltaY * 0.01;
        cameraDistance = Math.max(minCameraDistance, Math.min(maxCameraDistance, cameraDistance));
    } else {
        firstPersonCameraDistance += e.deltaY * 0.01;
        firstPersonCameraDistance = Math.max(minFirstPersonCameraDistance, Math.min(maxFirstPersonCameraDistance, firstPersonCameraDistance));
    }
}, { passive: false });

// Funciones de control
function setupControls() {
    document.getElementById('toggleViewBtn').onclick = () => {
        if (!isPaused && controls && !isTransitioning && level !== 5) {
            thirdPerson = !thirdPerson;
            isTransitioning = true;
            transitionProgress = 0;
            startPosition.copy(camera.position);
            startQuaternion.copy(camera.quaternion);
            if (thirdPerson) {
                controls.enabled = true;
                deviceControls.enabled = false;
                orientationToggle.style.display = 'none';
                if (player) {
                    controls.target.copy(player.position);
                    targetPosition.set(
                        player.position.x,
                        cameraHeight,
                        player.position.z + cameraDistance
                    );
                    const lookAtMatrix = new THREE.Matrix4().lookAt(
                        targetPosition,
                        player.position,
                        new THREE.Vector3(0, 1, 0)
                    );
                    targetQuaternion.setFromRotationMatrix(lookAtMatrix);
                }
            } else {
                controls.enabled = false;
                deviceControls.enabled = useDeviceOrientation;
                orientationToggle.style.display = 'block';
                if (player) {
                    const offset = new THREE.Vector3(
                        Math.sin(firstPersonCameraYaw) * firstPersonCameraDistance,
                        firstPersonCameraHeight,
                        Math.cos(firstPersonCameraYaw) * firstPersonCameraDistance
                    );
                    targetPosition.copy(player.position).add(offset);
                    const lookAtPoint = new THREE.Vector3(
                        player.position.x - Math.sin(firstPersonCameraYaw) * 5,
                        player.position.y,
                        player.position.z - Math.cos(firstPersonCameraYaw) * 5
                    );
                    const lookAtMatrix = new THREE.Matrix4().lookAt(
                        targetPosition,
                        lookAtPoint,
                        new THREE.Vector3(0, 1, 0)
                    );
                    targetQuaternion.setFromRotationMatrix(lookAtMatrix);
                }
            }
            document.getElementById('toggleViewBtn').textContent = thirdPerson ? 'Vista Primera Persona' : 'Vista Tercera Persona';
            renderer.domElement.style.filter = 'none';
        }
    };
    
    document.getElementById('restartBtn').onclick = () => {
        if (!isPaused) {
            resetGame();
        }
    };
    
    document.getElementById('nextLevelBtn').onclick = () => {
        showScreen('none');
        isPaused = false;
        renderer.domElement.style.filter = 'none';
        level = Math.min(level + 1, 5);
        updateLevelParameters();
        resetGame();
    };

    document.getElementById('menuBtn').onclick = () => {
        showScreen('mainMenu');
    };
    
    document.getElementById('restartGameBtn').onclick = () => {
        showScreen('none');
        renderer.domElement.style.filter = 'none';
        resetGame();
    };
    
    document.getElementById('menuBtnGameOver').onclick = () => {
        showScreen('mainMenu');
    };
    
    document.getElementById('startGameBtn').onclick = () => {
        showScreen('levelSelectScreen');
        renderer.domElement.style.filter = 'blur(5px)';
    };
    
    document.getElementById('instructionsBtn').onclick = () => {
        showScreen('instructionsScreen');
    };
    
    document.getElementById('settingsBtn').onclick = () => {
        showScreen('settingsScreen');
        renderer.domElement.style.filter = 'blur(5px)';
    };
    
    document.getElementById('creditsBtn').onclick = () => {
        showScreen('creditsScreen');
        renderer.domElement.style.filter = 'blur(5px)';
    };
    
    document.getElementById('exitBtn').onclick = () => {
        window.close();
    };
    
    document.getElementById('backBtnSettings').onclick = () => {
        showScreen('mainMenu');
    };
    
    document.getElementById('backBtnCredits').onclick = () => {
        showScreen('mainMenu');
    };
    
    document.getElementById('backBtnLevelSelect').onclick = () => {
        showScreen('mainMenu');
    };
    
    document.getElementById('backBtnInstructions').onclick = () => {
        showScreen('mainMenu');
    };
    
    document.getElementById('mouseSensitivity').oninput = e => {
        mouseSensitivity = parseFloat(e.target.value);
    };
}

// Actualizar parámetros según nivel
function updateLevelParameters() {
    mazeWidth = level === 5 ? 19 : 15 + (level - 1) * 2;
    mazeHeight = level === 5 ? 19 : 15 + (level - 1) * 2;
    goalPos = { x: mazeWidth - 2, z: mazeHeight - 2 };
    timeLimit = level === 5 ? 60 : (level >= 5 ? 40 : 60 + (level - 1) * 10);
    document.getElementById('level').textContent = `Nivel: ${level}`;
    // Forzar primera persona en nivel 5
    if (level === 5) {
        thirdPerson = false;
        controls.enabled = false;
        deviceControls.enabled = useDeviceOrientation;
        document.getElementById('toggleViewBtn').style.display = 'none';
        orientationToggle.style.display = 'block';
        if (player) {
            const offset = new THREE.Vector3(
                Math.sin(firstPersonCameraYaw) * firstPersonCameraDistance,
                firstPersonCameraHeight,
                Math.cos(firstPersonCameraYaw) * firstPersonCameraDistance
            );
            camera.position.copy(player.position).add(offset);
            const lookAtPoint = new THREE.Vector3(
                player.position.x - Math.sin(firstPersonCameraYaw) * 5,
                player.position.y,
                player.position.z - Math.cos(firstPersonCameraYaw) * 5
            );
            camera.lookAt(lookAtPoint);
        }
    } else {
        thirdPerson = true;
        controls.enabled = true;
        deviceControls.enabled = false;
        document.getElementById('toggleViewBtn').style.display = 'block';
        orientationToggle.style.display = 'none';
        document.getElementById('toggleViewBtn').textContent = 'Vista Primera Persona';
        if (player) {
            camera.position.set(
                player.position.x,
                cameraHeight,
                player.position.z + cameraDistance
            );
            camera.lookAt(player.position);
            controls.target.copy(player.position);
        }
    }
}

// Mostrar menú principal
function showMainMenu() {
    isPaused = true;
    showScreen('mainMenu');
    document.getElementById('status').textContent = 'Juego Pausado - Menú';
    renderer.domElement.style.filter = 'blur(5px)';
    clearInterval(timerInterval);
}

// Iniciar temporizador
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timer = 0;
    document.getElementById('timer').textContent = `Tiempo: ${timer.toFixed(1)}s / ${timeLimit.toFixed(1)}s`;
    timerInterval = setInterval(() => {
        if (!gameWon && !gameOver && !isPaused) {
            timer += 0.1;
            document.getElementById('timer').textContent = `Tiempo: ${timer.toFixed(1)}s / ${timeLimit.toFixed(1)}s`;
            if (timer >= timeLimit) {
                gameOver = true;
                isPaused = true;
                document.getElementById('status').textContent = '¡Tiempo Agotado!';
                showScreen('gameOverScreen');
                renderer.domElement.style.filter = 'none';
                clearInterval(timerInterval);
            }
        }
    }, 100);
}

// Resetear juego
function resetGame() {
    score = 0;
    lives = 5;
    gameWon = false;
    gameOver = false;
    isPaused = false;
    cameraDistance = 20;
    firstPersonCameraDistance = 3;
    firstPersonCameraYaw = 0;
    isTransitioning = false;
    transitionProgress = 0;
    useDeviceOrientation = false;
    deviceControls.enabled = false;
    orientationToggle.textContent = 'Activar Orientación';
    document.getElementById('score').textContent = `Puntaje: ${score}`;
    document.getElementById('lives').textContent = `Vidas: ${lives}`;
    document.getElementById('status').textContent = 'Encuentra la meta roja!';
    renderer.domElement.style.filter = 'none';
    createMaze();
    createGoal();
    createEnemies();
    loadPlayer();
    startTimer();
    // Asegurar la configuración de la cámara según el nivel
    if (level === 5) {
        thirdPerson = false;
        controls.enabled = false;
        deviceControls.enabled = useDeviceOrientation;
        document.getElementById('toggleViewBtn').style.display = 'none';
        orientationToggle.style.display = 'block';
    } else {
        thirdPerson = true;
        controls.enabled = true;
        deviceControls.enabled = false;
        document.getElementById('toggleViewBtn').style.display = 'block';
        orientationToggle.style.display = 'none';
        document.getElementById('toggleViewBtn').textContent = 'Vista Primera Persona';
    }
}

// Bucle de animación
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (isPaused) {
        renderer.render(scene, camera);
        return;
    }

    if (mixer) mixer.update(delta);

    if (player && !gameWon && !gameOver) {
        const direction = new THREE.Vector3();
        let isMoving = false;

        if (thirdPerson) {
            if (joystickActive && joystickDirection.length() > 0) {
                direction.set(joystickDirection.x, 0, joystickDirection.y);
                isMoving = true;
            }
            direction.normalize();
        } else {
            const forward = useDeviceOrientation 
                ? new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
                : new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), firstPersonCameraYaw);
            const right = useDeviceOrientation 
                ? new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
                : new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), firstPersonCameraYaw);
            if (joystickActive && joystickDirection.length() > 0) {
                direction.addScaledVector(forward, joystickDirection.y);
                direction.addScaledVector(right, joystickDirection.x);
                isMoving = true;
            }
            direction.normalize();
        }

        if (isMoving) {
            if (activeAction !== walkAction) {
                walkAction?.reset().play();
                idleAction?.stop();
                activeAction = walkAction;
            }
            const speed = keys[' '] || joystickDirection.length() > 0.7 ? 6 : 3;
            const move = direction.clone().multiplyScalar(speed * delta);
            const nextPos = player.position.clone().add(move);
            if (!detectCollision(nextPos)) {
                player.position.copy(nextPos);
                if (direction.length() > 0) {
                    const targetRotation = player.position.clone().add(direction);
                    player.lookAt(targetRotation);
                }
                score++;
                document.getElementById('score').textContent = `Puntaje: ${score}`;
            }
        } else {
            if (activeAction !== idleAction) {
                idleAction?.reset().play();
                walkAction?.stop();
                activeAction = idleAction;
            }
        }

        moveEnemies(delta);
        updateFireballs(delta);

        enemies.forEach(enemy => {
            if (player.position.distanceTo(enemy.mesh.position) < 1.5) {
                lives--;
                document.getElementById('lives').textContent = `Vidas: ${lives}`;
                enemy.mesh.position.set(
                    (Math.random() * mazeWidth - mazeWidth / 2) * blockSize,
                    0.8,
                    (Math.random() * mazeHeight - mazeHeight / 2) * blockSize
                );
                enemy.path = [];
                if (lives <= 0) {
                    gameOver = true;
                    isPaused = true;
                    document.getElementById('status').textContent = '¡Eliminado por un enemigo!';
                    showScreen('gameOverScreen');
                    renderer.domElement.style.filter = 'none';
                    clearInterval(timerInterval);
                }
            }
        });

        if (isTransitioning) {
            transitionProgress += delta * 2;
            if (transitionProgress >= 1) {
                transitionProgress = 1;
                isTransitioning = false;
            }
            camera.position.lerpVectors(startPosition, targetPosition, transitionProgress);
            camera.quaternion.slerpQuaternions(startQuaternion, targetQuaternion, transitionProgress);
            if (thirdPerson && controls) {
                controls.target.copy(player.position);
            }
        } else if (thirdPerson) {
            camera.position.set(
                player.position.x,
                cameraHeight,
                player.position.z + cameraDistance
            );
            camera.lookAt(player.position.x, player.position.y, player.position.z);
            controls.target.copy(player.position);
            controls.update();
        } else {
            if (useDeviceOrientation) {
                deviceControls.update();
                camera.position.copy(player.position).add(
                    new THREE.Vector3(0, firstPersonCameraHeight, firstPersonCameraDistance).applyQuaternion(camera.quaternion)
                );
            } else {
                const offset = new THREE.Vector3(
                    Math.sin(firstPersonCameraYaw) * firstPersonCameraDistance,
                    firstPersonCameraHeight,
                    Math.cos(firstPersonCameraYaw) * firstPersonCameraDistance
                );
                camera.position.copy(player.position).add(offset);
                const lookAtPoint = new THREE.Vector3(
                    player.position.x - Math.sin(firstPersonCameraYaw) * 5,
                    player.position.y,
                    player.position.z - Math.cos(firstPersonCameraYaw) * 5
                );
                camera.lookAt(lookAtPoint);
            }
        }

        if (goalMarker && player.position.distanceTo(goalMarker.position) < 2) {
            gameWon = true;
            isPaused = true;
            document.getElementById('status').textContent = level === 5 ? `🎉 ¡Completaste el juego!` : `🎉 ¡Ganaste el nivel ${level}!`;
            showScreen('winScreen');
            document.getElementById('nextLevelBtn').style.display = level === 5 ? 'none' : 'block';
            renderer.domElement.style.filter = 'none';
            clearInterval(timerInterval);
        }
    }

    renderer.render(scene, camera);
}

// Manejo de redimensionamiento
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Inicializar juego
function init() {
    initScene();
    setupLights();
    createGround();
    createMaze();
    createGoal();
    createEnemies();
    loadPlayer();
    setupControls();
    setupTouchControls();
    showMainMenu();
    animate();
}

init();