use wasm_bindgen::prelude::*;
use rayon::prelude::*;

// Export the rayon thread pool initialization for WASM
pub use wasm_bindgen_rayon::init_thread_pool;

/// Hungarian Algorithm (Kuhn-Munkres) for optimal assignment
/// Finds the minimum cost assignment between workers (cells) and jobs (beercap slots)
///
/// # Arguments
/// * `cost_matrix` - Flat array representing the cost matrix (row-major order)
/// * `num_rows` - Number of rows (workers/cells)
/// * `num_cols` - Number of columns (jobs/beercap slots)
///
/// # Returns
/// * Int32Array where result[i] = j means worker i is assigned to job j
#[wasm_bindgen]
pub fn hungarian_algorithm(cost_matrix: &[f64], num_rows: usize, num_cols: usize) -> Vec<i32> {
    let n = num_rows;
    let m = num_cols;
    
    // We need a square matrix for the algorithm, pad if necessary
    let size = n.max(m);
    
    // Create padded cost matrix using parallel iteration for large matrices
    let cost: Vec<f64> = if size > 50 {
        // Parallel version for larger matrices
        (0..size)
            .into_par_iter()
            .flat_map_iter(|i| {
                (0..size).map(move |j| {
                    if i < n && j < m {
                        cost_matrix[i * m + j]
                    } else {
                        0.0
                    }
                })
            })
            .collect()
    } else {
        // Sequential version for small matrices (overhead not worth it)
        let mut cost = vec![0.0f64; size * size];
        for i in 0..size {
            for j in 0..size {
                if i < n && j < m {
                    cost[i * size + j] = cost_matrix[i * m + j];
                }
            }
        }
        cost
    };
    
    // Run the Hungarian algorithm (sequential - inherently hard to parallelize)
    hungarian_core(&cost, size, n, m)
}

/// Core Hungarian algorithm implementation
fn hungarian_core(cost: &[f64], size: usize, n: usize, m: usize) -> Vec<i32> {
    // u and v are potentials for rows and columns (1-indexed, so size+1)
    let mut u = vec![0.0f64; size + 1];
    let mut v = vec![0.0f64; size + 1];
    // p[j] = row assigned to column j (1-indexed, 0 means unassigned)
    let mut p = vec![0usize; size + 1];
    // way[j] = previous column in augmenting path
    let mut way = vec![0usize; size + 1];
    
    for i in 1..=size {
        // Start augmenting path from row i
        p[0] = i;
        let mut j0 = 0usize; // Current column (0 is virtual)
        
        let mut minv = vec![f64::INFINITY; size + 1];
        let mut used = vec![false; size + 1];
        
        // Find augmenting path
        loop {
            used[j0] = true;
            let i0 = p[j0];
            let mut delta = f64::INFINITY;
            let mut j1 = 0usize;
            
            for j in 1..=size {
                if !used[j] {
                    // cost[i0-1][j-1] because our cost matrix is 0-indexed
                    let cur = cost[(i0 - 1) * size + (j - 1)] - u[i0] - v[j];
                    if cur < minv[j] {
                        minv[j] = cur;
                        way[j] = j0;
                    }
                    if minv[j] < delta {
                        delta = minv[j];
                        j1 = j;
                    }
                }
            }
            
            // Update potentials
            for j in 0..=size {
                if used[j] {
                    u[p[j]] += delta;
                    v[j] -= delta;
                } else {
                    minv[j] -= delta;
                }
            }
            
            j0 = j1;
            
            if p[j0] == 0 {
                break;
            }
        }
        
        // Reconstruct path
        loop {
            let j1 = way[j0];
            p[j0] = p[j1];
            j0 = j1;
            
            if j0 == 0 {
                break;
            }
        }
    }
    
    // Build result: assignment[i] = j means row i is assigned to column j
    let mut assignment = vec![-1i32; n];
    for j in 1..=size {
        if p[j] > 0 && p[j] <= n && j <= m {
            assignment[p[j] - 1] = (j - 1) as i32;
        }
    }
    
    assignment
}

/// Check if threads are available (for UI feedback)
#[wasm_bindgen]
pub fn threads_available() -> bool {
    rayon::current_num_threads() > 1
}

/// Get the number of threads in the pool
#[wasm_bindgen]
pub fn get_thread_count() -> usize {
    rayon::current_num_threads()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_hungarian_simple() {
        // Simple 3x3 cost matrix
        let cost = vec![
            1.0, 2.0, 3.0,
            4.0, 5.0, 6.0,
            7.0, 8.0, 9.0,
        ];
        
        let result = hungarian_algorithm(&cost, 3, 3);
        
        // Each row should be assigned to a unique column
        assert_eq!(result.len(), 3);
        assert!(result.iter().all(|&x| x >= 0 && x < 3));
        
        // Check all assignments are unique
        let mut seen = vec![false; 3];
        for &col in &result {
            assert!(!seen[col as usize]);
            seen[col as usize] = true;
        }
    }
    
    #[test]
    fn test_hungarian_rectangular() {
        // 2 rows, 3 columns - more jobs than workers
        let cost = vec![
            1.0, 5.0, 2.0,
            3.0, 1.0, 4.0,
        ];
        
        let result = hungarian_algorithm(&cost, 2, 3);
        
        assert_eq!(result.len(), 2);
        // Row 0 should get column 0 (cost 1) or column 2 (cost 2)
        // Row 1 should get column 1 (cost 1)
        assert!(result[0] >= 0 && result[0] < 3);
        assert!(result[1] >= 0 && result[1] < 3);
        assert_ne!(result[0], result[1]);
    }
}
