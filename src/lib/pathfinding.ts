export interface Point {
  x: number;
  y: number;
}

export function aStar(
  start: Point, 
  goal: Point, 
  grid: number[][], 
  width: number, 
  height: number,
  obstacles: Point[] = [] // Points that are strictly impassable (enemies/walls)
): Point[] {
  const openSet: Point[] = [start];
  const cameFrom: Map<string, Point> = new Map();
  
  const gScore: Map<string, number> = new Map();
  gScore.set(`${start.x},${start.y}`, 0);
  
  const fScore: Map<string, number> = new Map();
  fScore.set(`${start.x},${start.y}`, heuristic(start, goal));

  while (openSet.length > 0) {
    let current = openSet[0];
    let lowestF = fScore.get(`${current.x},${current.y}`) || Infinity;
    let currentIndex = 0;

    for (let i = 1; i < openSet.length; i++) {
      const score = fScore.get(`${openSet[i].x},${openSet[i].y}`) || Infinity;
      if (score < lowestF) {
        lowestF = score;
        current = openSet[i];
        currentIndex = i;
      }
    }

    if (current.x === goal.x && current.y === goal.y) {
      return reconstructPath(cameFrom, current);
    }

    openSet.splice(currentIndex, 1);

    const neighbors = getNeighbors(current, width, height);
    for (const neighbor of neighbors) {
      // Check if terrain is wall (1)
      if (grid[neighbor.y][neighbor.x] === 1) continue;
      
      // Check if tile is a strictly impassable obstacle (enemy)
      if (obstacles.some(o => o.x === neighbor.x && o.y === neighbor.y)) continue;

      const tentativeGScore = (gScore.get(`${current.x},${current.y}`) || 0) + 1;
      const neighborG = gScore.get(`${neighbor.x},${neighbor.y}`) ?? Infinity;

      if (tentativeGScore < neighborG) {
        cameFrom.set(`${neighbor.x},${neighbor.y}`, current);
        gScore.set(`${neighbor.x},${neighbor.y}`, tentativeGScore);
        fScore.set(`${neighbor.x},${neighbor.y}`, tentativeGScore + heuristic(neighbor, goal));
        
        if (!openSet.some(p => p.x === neighbor.x && p.y === neighbor.y)) {
          openSet.push(neighbor);
        }
      }
    }
  }

  return [];
}

function heuristic(a: Point, b: Point): number {
  // Manhattan distance for orthogonal movement
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function getNeighbors(p: Point, width: number, height: number): Point[] {
  const neighbors: Point[] = [];
  if (p.x > 0) neighbors.push({ x: p.x - 1, y: p.y });
  if (p.x < width - 1) neighbors.push({ x: p.x + 1, y: p.y });
  if (p.y > 0) neighbors.push({ x: p.x, y: p.y - 1 });
  if (p.y < height - 1) neighbors.push({ x: p.x, y: p.y + 1 });
  return neighbors;
}

function reconstructPath(cameFrom: Map<string, Point>, current: Point): Point[] {
  const totalPath = [current];
  let currKey = `${current.x},${current.y}`;
  while (cameFrom.has(currKey)) {
    current = cameFrom.get(currKey)!;
    currKey = `${current.x},${current.y}`;
    totalPath.unshift(current);
  }
  return totalPath;
}
