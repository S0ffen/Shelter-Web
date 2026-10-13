// Explicit imports keep the prototype free of unrelated Babylon subsystems.
import '@babylonjs/core/Collisions/collisionCoordinator.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import '@babylonjs/core/Culling/ray.js';
import '@babylonjs/core/Meshes/instancedMesh.js';
// PBR's shared BRDF LUT must decode before any city material can become ready.
// Register these eagerly so modular/Vite loading never falls back to fetching .fx as HTML.
import '@babylonjs/core/Shaders/rgbdDecode.fragment.js';
import '@babylonjs/core/Shaders/postprocess.vertex.js';
import '@babylonjs/core/Shaders/shadowMap.vertex.js';
import '@babylonjs/core/Shaders/shadowMap.fragment.js';
import '@babylonjs/core/Shaders/default.vertex.js';
import '@babylonjs/core/Shaders/default.fragment.js';
import '@babylonjs/core/Shaders/pbr.vertex.js';
import '@babylonjs/core/Shaders/pbr.fragment.js';

export { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
export { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
export { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
export { Engine } from '@babylonjs/core/Engines/engine.js';
export { Scene } from '@babylonjs/core/scene.js';
export { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
export { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
export { Mesh } from '@babylonjs/core/Meshes/mesh.js';
export { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
export { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder.js';
export { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
export { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
export { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
export { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
export { CreatePolyhedron } from '@babylonjs/core/Meshes/Builders/polyhedronBuilder.js';
export { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
export { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
export { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera.js';
export { PointLight } from '@babylonjs/core/Lights/pointLight.js';
export { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
export { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';

export { Light } from '@babylonjs/core/Lights/light.js';
