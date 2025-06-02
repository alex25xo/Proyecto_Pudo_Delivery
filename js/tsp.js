// js/tsp.js
function total(order, mat){
  let sum = 0;
  for(let i=0;i<order.length-1;i++){
    sum += mat[order[i]][order[i+1]];
  }
  return sum;
}

/** BRPM / hill-climbing simple (intercambio 2) */
export function optimize(order, mat){
  let best = order.slice();
  let bestCost = total(best, mat);
  let improved = true;

  while(improved){
    improved = false;
    for(let i=1;i<order.length-2;i++){
      for(let j=i+1;j<order.length-1;j++){
        const cand = best.slice();
        [cand[i], cand[j]] = [cand[j], cand[i]];
        const cost = total(cand, mat);
        if(cost < bestCost){
          bestCost = cost;
          best = cand;
          improved = true;
        }
      }
    }
  }
  return best;
}
/* ---------- utilidades y multi-start ---------- */
export function pathCost(order, m){
  let s = 0;
  for(let i=0;i<order.length-1;i++) s += m[order[i]][order[i+1]];
  return s;
}

/**
 * Ejecuta tu hill-climb N veces desde órdenes mezclados
 * y devuelve el mejor encontrado.
 * @param {number[]} baseOrder   orden inicial (0,1,2...)
 * @param {number[][]} matrix    matriz de duraciones
 * @param {number} restarts      nº de reinicios aleatorios
 */
export function multiStartOptimize(baseOrder, matrix, restarts = 25){
  let best = optimize(baseOrder, matrix);
  let bestCost = pathCost(best, matrix);

  // fijamos origen (índice 0) y barajamos el resto
  for(let r = 0; r < restarts; r++){
    const shuffled = baseOrder.slice(1)
      .sort(() => Math.random() - .5);
    const candidate = optimize([0, ...shuffled], matrix);
    const cost = pathCost(candidate, matrix);
    if(cost < bestCost){
      best = candidate;
      bestCost = cost;
    }
  }
  return best;
}
