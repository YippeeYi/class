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
  collider: { shapes: ColliderShape[] }
  nextId: string | null
  points: number
  color: string
}

// sourceSize records the reference art dimensions; collision coordinates stay normalized.
// Each shape must be convex. A silhouette with inlets can use overlapping convex shapes.
export const QB_LEVELS: readonly QbLevel[] = [
  {
    id: '01',
    name: '一级 QB',
    image: '01.png',
    sourceSize: { width: 256, height: 256 },
    visualSize: { width: 32, height: 32 },
    physicsSize: { width: 32, height: 32 },
    collider: { shapes: [{ type: 'circle', x: 0.5, y: 0.5, radius: 0.46 }] },
    nextId: '02',
    points: 1,
    color: '#f8bb86',
  },
  {
    id: '02',
    name: '二级 QB',
    image: '02.png',
    sourceSize: { width: 256, height: 256 },
    visualSize: { width: 40, height: 40 },
    physicsSize: { width: 40, height: 40 },
    collider: { shapes: [{ type: 'circle', x: 0.5, y: 0.5, radius: 0.46 }] },
    nextId: '03',
    points: 3,
    color: '#f2a0a8',
  },
  {
    id: '03',
    name: '三级 QB',
    image: '03.png',
    sourceSize: { width: 256, height: 256 },
    visualSize: { width: 49, height: 49 },
    physicsSize: { width: 49, height: 49 },
    collider: { shapes: [{ type: 'circle', x: 0.5, y: 0.5, radius: 0.46 }] },
    nextId: '04',
    points: 6,
    color: '#e6c273',
  },
  {
    id: '04',
    name: '四级 QB',
    image: '04.png',
    sourceSize: { width: 256, height: 256 },
    visualSize: { width: 59, height: 59 },
    physicsSize: { width: 59, height: 59 },
    collider: { shapes: [{ type: 'circle', x: 0.5, y: 0.5, radius: 0.46 }] },
    nextId: '05',
    points: 10,
    color: '#b7d582',
  },
  {
    id: '05',
    name: '五级 QB',
    image: '05.png',
    sourceSize: { width: 256, height: 256 },
    visualSize: { width: 71, height: 71 },
    physicsSize: { width: 71, height: 71 },
    collider: { shapes: [{ type: 'circle', x: 0.5, y: 0.5, radius: 0.46 }] },
    nextId: '06',
    points: 15,
    color: '#8fcfbd',
  },
  {
    id: '06',
    name: '六级 QB',
    image: '06.png',
    sourceSize: { width: 256, height: 256 },
    visualSize: { width: 85, height: 85 },
    physicsSize: { width: 85, height: 85 },
    collider: { shapes: [{ type: 'circle', x: 0.5, y: 0.5, radius: 0.46 }] },
    nextId: '07',
    points: 21,
    color: '#91c5e0',
  },
  {
    id: '07',
    name: '七级 QB',
    image: '07.png',
    sourceSize: { width: 256, height: 256 },
    visualSize: { width: 101, height: 101 },
    physicsSize: { width: 101, height: 101 },
    collider: { shapes: [{ type: 'circle', x: 0.5, y: 0.5, radius: 0.46 }] },
    nextId: '08',
    points: 28,
    color: '#b2ade5',
  },
  {
    id: '08',
    name: '八级 QB',
    image: '08.png',
    sourceSize: { width: 256, height: 256 },
    visualSize: { width: 121, height: 121 },
    physicsSize: { width: 121, height: 121 },
    collider: { shapes: [{ type: 'circle', x: 0.5, y: 0.5, radius: 0.46 }] },
    nextId: '09',
    points: 36,
    color: '#dda6d9',
  },
  {
    id: '09',
    name: '九级 QB',
    image: '09.png',
    sourceSize: { width: 256, height: 256 },
    visualSize: { width: 143, height: 143 },
    physicsSize: { width: 143, height: 143 },
    collider: { shapes: [{ type: 'circle', x: 0.5, y: 0.5, radius: 0.46 }] },
    nextId: '10',
    points: 45,
    color: '#e5a3aa',
  },
  {
    id: '10',
    name: '十级 QB',
    image: '10.png',
    sourceSize: { width: 256, height: 256 },
    visualSize: { width: 170, height: 170 },
    physicsSize: { width: 170, height: 170 },
    collider: { shapes: [{ type: 'circle', x: 0.5, y: 0.5, radius: 0.46 }] },
    nextId: '11',
    points: 55,
    color: '#e3ba76',
  },
  {
    id: '11',
    name: '大 QB',
    image: '11.png',
    sourceSize: { width: 256, height: 256 },
    visualSize: { width: 202, height: 202 },
    physicsSize: { width: 202, height: 202 },
    collider: { shapes: [{ type: 'circle', x: 0.5, y: 0.5, radius: 0.46 }] },
    nextId: null,
    points: 66,
    color: '#d7ae74',
  },
]

export const QB_LEVEL_BY_ID = new Map(QB_LEVELS.map((level) => [level.id, level]))

export function levelImageUrl(level: QbLevel) {
  return `${import.meta.env.BASE_URL}games/merge-qb/${level.image}`
}
