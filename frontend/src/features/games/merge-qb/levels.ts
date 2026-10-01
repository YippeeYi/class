export type Point = { x: number; y: number }

// Coordinates are fractions of the source image, measured from its top-left corner.
export type ColliderShape =
  | { type: 'circle'; x: number; y: number; radius: number }
  | { type: 'rectangle'; x: number; y: number; width: number; height: number }
  | { type: 'polygon'; vertices: Point[] }

export type QbLevel = {
  id: string
  name: string
  image: string
  sourceSize: { width: number; height: number }
  visualSize: { width: number; height: number }
  physicsSize: { width: number; height: number }
  mass: number
  visibleBounds: { left: number; top: number; right: number; bottom: number }
  collider: { shapes: ColliderShape[] }
  nextId: string | null
  points: number
  color: string
}

// Geometry was measured from the alpha >= 64 silhouettes of the 11 local PNGs.
// Collider vertices are simplified convex hulls in source-image coordinates.
// mass is in Matter.js mass units (> 0): larger values resist motion more; setMass keeps it independent of size.
export const QB_LEVELS: readonly QbLevel[] = [
  {
    id: '01',
    name: '一级 QB',
    image: '01.png',
    sourceSize: { width: 56, height: 54 },
    visualSize: { width: 41.67, height: 40.19 },
    physicsSize: { width: 41.67, height: 40.19 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.214, y: 0.333 },
            { x: 0.268, y: 0.259 },
            { x: 0.411, y: 0.185 },
            { x: 0.571, y: 0.222 },
            { x: 0.643, y: 0.296 },
            { x: 0.714, y: 0.463 },
            { x: 0.732, y: 0.741 },
            { x: 0.679, y: 0.852 },
            { x: 0.518, y: 0.981 },
            { x: 0.375, y: 0.981 },
            { x: 0.214, y: 0.852 },
            { x: 0.161, y: 0.741 },
          ],
        },
      ],
    },
    mass: 1.8,
    visibleBounds: { left: 0.161, top: 0.185, right: 0.732, bottom: 0.981 },
    nextId: '02',
    points: 1,
    color: '#f8bb86',
  },
  {
    id: '02',
    name: '二级 QB',
    image: '02.png',
    sourceSize: { width: 745, height: 785 },
    visualSize: { width: 41.91, height: 44.16 },
    physicsSize: { width: 41.91, height: 44.16 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.031, y: 0.647 },
            { x: 0.148, y: 0.362 },
            { x: 0.379, y: 0.122 },
            { x: 0.419, y: 0.097 },
            { x: 0.517, y: 0.117 },
            { x: 0.972, y: 0.668 },
            { x: 0.952, y: 0.78 },
            { x: 0.839, y: 0.882 },
            { x: 0.792, y: 0.887 },
            { x: 0.165, y: 0.876 },
            { x: 0.09, y: 0.825 },
            { x: 0.032, y: 0.724 },
          ],
        },
      ],
    },
    mass: 2.2,
    visibleBounds: { left: 0.026, top: 0.097, right: 0.98, bottom: 0.887 },
    nextId: '03',
    points: 3,
    color: '#f2a0a8',
  },
  {
    id: '03',
    name: '三级 QB',
    image: '03.png',
    sourceSize: { width: 1701, height: 1975 },
    visualSize: { width: 50.51, height: 58.65 },
    physicsSize: { width: 50.51, height: 58.65 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.146, y: 0.668 },
            { x: 0.225, y: 0.309 },
            { x: 0.268, y: 0.213 },
            { x: 0.437, y: 0.132 },
            { x: 0.636, y: 0.157 },
            { x: 0.753, y: 0.289 },
            { x: 0.805, y: 0.506 },
            { x: 0.673, y: 0.891 },
            { x: 0.531, y: 0.967 },
            { x: 0.425, y: 0.967 },
            { x: 0.33, y: 0.932 },
            { x: 0.203, y: 0.81 },
          ],
        },
      ],
    },
    mass: 2.69,
    visibleBounds: { left: 0.146, top: 0.132, right: 0.806, bottom: 0.967 },
    nextId: '04',
    points: 6,
    color: '#e6c273',
  },
  {
    id: '04',
    name: '四级 QB',
    image: '04.png',
    sourceSize: { width: 314, height: 575 },
    visualSize: { width: 56.14, height: 102.8 },
    physicsSize: { width: 56.14, height: 102.8 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.105, y: 0.602 },
            { x: 0.143, y: 0.282 },
            { x: 0.271, y: 0.205 },
            { x: 0.389, y: 0.183 },
            { x: 0.497, y: 0.188 },
            { x: 0.586, y: 0.219 },
            { x: 0.755, y: 0.376 },
            { x: 0.803, y: 0.598 },
            { x: 0.723, y: 0.683 },
            { x: 0.538, y: 0.751 },
            { x: 0.306, y: 0.737 },
            { x: 0.153, y: 0.661 },
          ],
        },
      ],
    },
    mass: 3.3,
    visibleBounds: { left: 0.105, top: 0.183, right: 0.803, bottom: 0.757 },
    nextId: '05',
    points: 10,
    color: '#b7d582',
  },
  {
    id: '05',
    name: '五级 QB',
    image: '05.png',
    sourceSize: { width: 768, height: 1280 },
    visualSize: { width: 56.8, height: 94.67 },
    physicsSize: { width: 56.8, height: 94.67 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.044, y: 0.866 },
            { x: 0.133, y: 0.444 },
            { x: 0.219, y: 0.338 },
            { x: 0.408, y: 0.259 },
            { x: 0.652, y: 0.259 },
            { x: 0.831, y: 0.347 },
            { x: 0.889, y: 0.409 },
            { x: 0.893, y: 0.5 },
            { x: 0.794, y: 0.894 },
            { x: 0.568, y: 0.988 },
            { x: 0.37, y: 0.997 },
            { x: 0.204, y: 0.963 },
          ],
        },
      ],
    },
    mass: 4.1,
    visibleBounds: { left: 0.044, top: 0.247, right: 0.896, bottom: 0.997 },
    nextId: '06',
    points: 15,
    color: '#8fcfbd',
  },
  {
    id: '06',
    name: '六级 QB',
    image: '06.png',
    sourceSize: { width: 295, height: 451 },
    visualSize: { width: 55.72, height: 85.19 },
    physicsSize: { width: 55.72, height: 85.19 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.0, y: 0.093 },
            { x: 0.054, y: 0.018 },
            { x: 0.112, y: 0.0 },
            { x: 0.861, y: 0.0 },
            { x: 0.959, y: 0.058 },
            { x: 0.997, y: 0.129 },
            { x: 0.993, y: 0.772 },
            { x: 0.908, y: 0.925 },
            { x: 0.841, y: 0.998 },
            { x: 0.108, y: 0.998 },
            { x: 0.027, y: 0.92 },
            { x: 0.0, y: 0.849 },
          ],
        },
      ],
    },
    mass: 5.13,
    visibleBounds: { left: 0.0, top: 0.0, right: 0.997, bottom: 0.998 },
    nextId: '07',
    points: 21,
    color: '#91c5e0',
  },
  {
    id: '07',
    name: '七级 QB',
    image: '07.png',
    sourceSize: { width: 1280, height: 1700 },
    visualSize: { width: 140.52, height: 186.63 },
    physicsSize: { width: 140.52, height: 186.63 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.238, y: 0.414 },
            { x: 0.375, y: 0.118 },
            { x: 0.438, y: 0.075 },
            { x: 0.541, y: 0.052 },
            { x: 0.621, y: 0.066 },
            { x: 0.706, y: 0.113 },
            { x: 0.745, y: 0.179 },
            { x: 0.774, y: 0.466 },
            { x: 0.677, y: 0.555 },
            { x: 0.569, y: 0.593 },
            { x: 0.468, y: 0.593 },
            { x: 0.33, y: 0.536 },
          ],
        },
      ],
    },
    mass: 6.41,
    visibleBounds: { left: 0.237, top: 0.052, right: 0.774, bottom: 0.593 },
    nextId: '08',
    points: 28,
    color: '#b2ade5',
  },
  {
    id: '08',
    name: '八级 QB',
    image: '08.png',
    sourceSize: { width: 1920, height: 1080 },
    visualSize: { width: 127.44, height: 71.68 },
    physicsSize: { width: 127.44, height: 71.68 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.052, y: 0.539 },
            { x: 0.278, y: 0.256 },
            { x: 0.331, y: 0.244 },
            { x: 0.56, y: 0.383 },
            { x: 0.557, y: 0.783 },
            { x: 0.284, y: 0.85 },
            { x: 0.215, y: 0.822 },
            { x: 0.058, y: 0.678 },
            { x: 0.039, y: 0.6 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.52, y: 0.367 },
            { x: 0.891, y: 0.228 },
            { x: 0.916, y: 0.272 },
            { x: 0.92, y: 0.322 },
            { x: 0.918, y: 0.456 },
            { x: 0.906, y: 0.483 },
            { x: 0.774, y: 0.522 },
            { x: 0.626, y: 0.556 },
            { x: 0.52, y: 0.556 },
          ],
        },
        {
          type: 'polygon',
          vertices: [
            { x: 0.52, y: 0.522 },
            { x: 0.774, y: 0.522 },
            { x: 0.968, y: 0.711 },
            { x: 0.979, y: 0.733 },
            { x: 0.983, y: 0.756 },
            { x: 0.989, y: 0.833 },
            { x: 0.983, y: 0.85 },
            { x: 0.817, y: 0.828 },
            { x: 0.52, y: 0.783 },
          ],
        },
      ],
    },
    mass: 8.15,
    visibleBounds: { left: 0.039, top: 0.228, right: 0.989, bottom: 0.85 },
    nextId: '09',
    points: 36,
    color: '#dda6d9',
  },
  {
    id: '09',
    name: '九级 QB',
    image: '09.png',
    sourceSize: { width: 140, height: 137 },
    visualSize: { width: 171.11, height: 167.44 },
    physicsSize: { width: 171.11, height: 167.44 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.186, y: 0.387 },
            { x: 0.236, y: 0.263 },
            { x: 0.329, y: 0.182 },
            { x: 0.443, y: 0.139 },
            { x: 0.543, y: 0.139 },
            { x: 0.643, y: 0.182 },
            { x: 0.736, y: 0.277 },
            { x: 0.779, y: 0.365 },
            { x: 0.821, y: 0.62 },
            { x: 0.7072, y: 0.993 },
            { x: 0.286, y: 0.993 },
            { x: 0.157, y: 0.664 },
          ],
        },
      ],
    },
    mass: 10.25,
    visibleBounds: { left: 0.157, top: 0.139, right: 0.821, bottom: 0.993 },
    nextId: '10',
    points: 45,
    color: '#e5a3aa',
  },
  {
    id: '10',
    name: '十级 QB',
    image: '10.png',
    sourceSize: { width: 350, height: 379 },
    visualSize: { width: 183.64, height: 198.86 },
    physicsSize: { width: 183.64, height: 198.86 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.009, y: 0.802 },
            { x: 0.251, y: 0.285 },
            { x: 0.297, y: 0.216 },
            { x: 0.426, y: 0.153 },
            { x: 0.566, y: 0.142 },
            { x: 0.683, y: 0.185 },
            { x: 0.771, y: 0.28 },
            { x: 0.794, y: 0.391 },
            { x: 0.66, y: 0.96 },
            { x: 0.617, y: 0.997 },
            { x: 0.043, y: 0.997 },
            { x: 0.0, y: 0.96 },
          ],
        },
      ],
    },
    mass: 13.04,
    visibleBounds: { left: 0.0, top: 0.142, right: 0.794, bottom: 0.997 },
    nextId: '11',
    points: 55,
    color: '#e3ba76',
  },
  {
    id: '11',
    name: '大 QB',
    image: '11.png',
    sourceSize: { width: 1475, height: 1095 },
    visualSize: { width: 328.5, height: 243.87 },
    physicsSize: { width: 328.5, height: 243.87 },
    collider: {
      shapes: [
        {
          type: 'polygon',
          vertices: [
            { x: 0.182, y: 0.455 },
            { x: 0.239, y: 0.296 },
            { x: 0.336, y: 0.236 },
            { x: 0.534, y: 0.279 },
            { x: 0.661, y: 0.46 },
            { x: 0.79, y: 0.904 },
            { x: 0.77, y: 0.964 },
            { x: 0.618, y: 0.975 },
            { x: 0.471, y: 0.91 },
            { x: 0.405, y: 0.855 },
            { x: 0.204, y: 0.619 },
            { x: 0.176, y: 0.553 },
          ],
        },
      ],
    },
    mass: 16.66,
    visibleBounds: { left: 0.176, top: 0.236, right: 0.791, bottom: 0.975 },
    nextId: null,
    points: 66,
    color: '#d7ae74',
  },
]

export const QB_LEVEL_BY_ID = new Map(QB_LEVELS.map((level) => [level.id, level]))

export function levelImagePath(level: QbLevel) {
  return `images/games/merge-qb/${level.image}`
}

// Matter.js combines dynamic friction with min(A, B), static multiplier with max(A, B).
// friction is dynamic contact drag [0, 1]; frictionStatic is a multiplier >= 0, not a separate coefficient.
// Increasing either resists sliding. frictionAir is per-step drag in air [0, 1].
// restitution is bounce [0, 1]: larger values rebound more.
export const QB_PHYSICS = {
  qb: { friction: 0.58, frictionStatic: 0.8, frictionAir: 0.002, restitution: 0.08 },
  wall: { friction: 0.58, frictionStatic: 0.8, restitution: 0.08 },
} as const

// Pixel stroke is rendered at final canvas scale, independent of level size and DPR.
export const QB_OUTLINE = { widthCssPx: 1.5, color: '#332b27' } as const

// Force is applied once per merge in Matter.js world units; caps keep large merges contained.
export const QB_SHOCKWAVE = {
  baseRadius: 90,
  radiusPerSize: 0.7,
  maxRadius: 240,
  baseForce: 0.0025,
  forcePerSize: 0.000025,
  maxForce: 0.011,
  durationMs: 360,
  lineWidthCssPx: 1.5,
} as const
