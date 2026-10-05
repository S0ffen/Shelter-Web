// Explicit imports keep the prototype free of unrelated Babylon subsystems.
import '@babylonjs/core/Collisions/collisionCoordinator.js';
import '@babylonjs/core/Culling/ray.js';
import '@babylonjs/core/Meshes/instancedMesh.js';

export { Engine } from '@babylonjs/core/Engines/engine.js';
export { Scene } from '@babylonjs/core/scene.js';
export { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
export { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
export { Mesh } from '@babylonjs/core/Meshes/mesh.js';
export { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
export { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
export { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
export { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
export { CreatePolyhedron } from '@babylonjs/core/Meshes/Builders/polyhedronBuilder.js';
export { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
export { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera.js';
export { PointLight } from '@babylonjs/core/Lights/pointLight.js';
export { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
export { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
