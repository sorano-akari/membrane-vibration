// シミュレーションのグリッドサイズ
const GRID_WIDTH = 100;
const GRID_HEIGHT = 100;

// 波の伝播速度の係数（この値を調整して、波の動きを変えてみよう）
// 安定性を確保するため、0.5以下に設定することが推奨されます。
const C_SQUARED = 0.45; 

// 減衰係数（0.0〜1.0の範囲、1.0に近いほど減衰が少ない）
// 0.995付近が、減衰と反射の両方を視認しやすい値です。
const DAMPING = 0.995;

// 膜の変位（高さ）を格納する2次元配列
let u_current;  // 現在の時刻の変位
let u_previous; // 1つ前の時刻の変位

// パルスのデフォルト強度
const DEFAULT_PULSE_AMPLITUDE = 200; 
// スライダーで設定可能なパルスの最大強度
const MAX_SLIDER_PULSE_AMPLITUDE = 500;
const MIN_SLIDER_PULSE_AMPLITUDE = 10;

let FIXED_LOG_MAX; // 色のマッピング基準となる固定の対数スケールの最大値

// パルスが一度加えられたかどうかのフラグ
let hasPulsed = false; 

let pulseStrengthSlider; // パルス強度のスライダー
let pulseStrengthLabel; // スライダーの値を表示するラベル

/**
 * P5.jsの初期設定を行う関数
 * キャンバスの作成、色モードの設定、配列の初期化など
 */
function setup() {
  // 描画領域を400x400ピクセルで作成
  createCanvas(400, 400);
  pixelDensity(1); // 解像度を一定に保つ（Retinaディスプレイなどでピクセルが2倍になるのを防ぐ）
  noStroke();      // 図形の境界線を描画しない

  // 色空間をHSL（Hue, Saturation, Lightness）に設定
  // Hue: 0-360, Saturation: 0-100, Lightness: 0-100
  colorMode(HSL, 360, 100, 100); 

  // シミュレーションを初期化
  resetSimulation();

  // 色のマッピング基準となる固定の対数スケール最大値を計算
  // FIXED_LOG_MAXは、スライダーで設定可能な最大パルス強度に基づいて計算する
  // log(0)を避けるため +1 する
  FIXED_LOG_MAX = log(MAX_SLIDER_PULSE_AMPLITUDE + 1);
  // FIXED_LOG_MAXが0になるのを防ぐためのガード
  if (FIXED_LOG_MAX === 0) {
      FIXED_LOG_MAX = 1; 
  }

  // リセットボタン
  let resetButton = createButton('リセット'); // ボタンを作成
  resetButton.position(width / 2 + 50, height + 20); // キャンバスの右下に配置
  resetButton.mousePressed(resetSimulation); // クリック時にresetSimulation関数を呼び出す

  // 強度スライダーのラベル
  pulseStrengthLabel = createP('叩く強さ: ' + DEFAULT_PULSE_AMPLITUDE);
  pulseStrengthLabel.position(width / 2 - 190, height); // ボタンの左に配置

  // 強度スライダー
  pulseStrengthSlider = createSlider(MIN_SLIDER_PULSE_AMPLITUDE, MAX_SLIDER_PULSE_AMPLITUDE, DEFAULT_PULSE_AMPLITUDE); // スライダーを作成
  pulseStrengthSlider.position(width / 2 - 190, height + 30); // ラベルの下に配置
  pulseStrengthSlider.style('width', '150px'); // スライダーの幅を調整
}

/**
 * P5.jsの描画ループ関数
 * 毎フレーム、シミュレーションの計算と描画を行う
 */
function draw() {
  background(0); // 背景を黒に変更して、膜を際立たせる

  // スライダーの現在の値をラベルに表示
  pulseStrengthLabel.html('叩く強さ: ' + pulseStrengthSlider.value());

  // 次の時刻の変位を格納する一時的な配列を初期化
  let u_next = create2DArray(GRID_WIDTH, GRID_HEIGHT);

  // シミュレーションの計算（円形領域の各グリッド点を更新）
  // グリッドの端は固定端として計算から除外するため i, j は 1 から開始し、GRID_WIDTH/HEIGHT - 1 で終了
  for (let i = 1; i < GRID_WIDTH - 1; i++) {
    for (let j = 1; j < GRID_HEIGHT - 1; j++) {
      // グリッドの中心からの距離を計算（円形境界のため）
      let x = i - GRID_WIDTH / 2;
      let y = j - GRID_HEIGHT / 2;
      let distance = sqrt(x * x + y * y);

      // 距離が指定した半径より小さい場合のみ計算を行う
      // GRID_WIDTH / 2 - 2 は円の半径を意味し、-2は境界の安定性のため
      if (distance < GRID_WIDTH / 2 - 2) {
        // ラプラシアンの計算（空間的な2階微分）
        // 周囲4点（上下左右）の変位の合計から、中央の変位の4倍を引く
        let laplacian = u_current[i - 1][j] + u_current[i + 1][j] + u_current[i][j - 1] + u_current[i][j + 1] - 4 * u_current[i][j];
        
        // 速度の計算（現在の変位から前の変位を引く）
        let velocity = u_current[i][j] - u_previous[i][j];

        // 波動方程式の数値計算（Verlet積分に減衰項を追加した形）
        // u_next = u_current + velocity * DAMPING + C_SQUARED * laplacian
        u_next[i][j] = u_current[i][j] + velocity * DAMPING + C_SQUARED * laplacian;

        // 計算結果が過度に増幅するのを防ぐため、スライダーの最大値の2倍に制限
        u_next[i][j] = constrain(u_next[i][j], -MAX_SLIDER_PULSE_AMPLITUDE * 2, MAX_SLIDER_PULSE_AMPLITUDE * 2); 
      }
    }
  }

  // 計算した結果を反映させる
  // u_previousにu_currentを、u_currentにu_nextをコピーして、次のフレームの準備をする
  u_previous = u_current;
  u_current = u_next;

  // 描画
  // 各グリッドセル（ピクセル）の幅と高さを計算し、キャンバス全体に広がるようにする
  let cellWidth = width / GRID_WIDTH;
  let cellHeight = height / GRID_HEIGHT;

  // 個々の矩形には境界線を描画しないことを保証
  noStroke(); 

  // 描画範囲を円の境界に限定 (最適化のため)
  let startX = max(0, Math.floor(GRID_WIDTH/2 - (GRID_WIDTH/2 - 2)));
  let endX = min(GRID_WIDTH, Math.ceil(GRID_WIDTH/2 + (GRID_WIDTH/2 - 2)));
  let startY = max(0, Math.floor(GRID_HEIGHT/2 - (GRID_HEIGHT/2 - 2)));
  let endY = min(GRID_HEIGHT, Math.ceil(GRID_HEIGHT/2 + (GRID_HEIGHT/2 - 2)));


  for (let i = startX; i < endX; i++) {
    for (let j = startY; j < endY; j++) {
      let x_center_dist = i - GRID_WIDTH / 2;
      let y_center_dist = j - GRID_HEIGHT / 2;
      let distance_to_center = sqrt(x_center_dist * x_center_dist + y_center_dist * y_center_dist);
      
      // 円の内側にあるグリッドセルのみ、色を計算して描画
      if (distance_to_center < GRID_WIDTH / 2 - 2) {
          let val = u_current[i][j];    // 現在のグリッド点の変位
          let absVal = abs(val);      // 変位の絶対値
          
          // 変位の絶対値を対数スケールに変換
          // log(0)を避けるため +1 する
          let logVal = log(absVal + 1);
          
          let hue = 0;      // 色相
          let saturation = 0; // 彩度
          let lightness = 0; // 明度

          // 彩度を対数スケールでマッピング（0から100）
          saturation = map(logVal, 0, FIXED_LOG_MAX, 0, 100);
          saturation = constrain(saturation, 0, 100); // 0-100の範囲に制限

          // === 変更点：明度を対数スケールでマッピング（0から95：真っ暗からより明るい色へ） ===
          lightness = map(logVal, 0, FIXED_LOG_MAX, 0, 95); // 90に変更
          lightness = constrain(lightness, 0, 100); // 0-100の範囲に制限
          // === 変更点ここまで ===

          // 変位の符号に応じて色相を設定
          if (val > 0) {
              hue = 0; // 正の変位は赤（Hue 0）
          } else if (val < 0) {
              hue = 240; // 負の変位は青（Hue 240）
          } else {
              // 変位が完全にゼロの場合
              // logVal が 0 になるため、saturation と lightness も 0 にマッピングされ、黒色になる
              hue = 0; 
          }
          fill(hue, saturation, lightness);
          rect(i * cellWidth, j * cellHeight, cellWidth, cellHeight);
      }
    }
  }

  // 円形の境界線を描画
  noFill(); // 塗りつぶしなし
  stroke(120, 100, 50); // 緑色（Hue 120, 彩度 100, 明度 50）
  strokeWeight(2); // 線の太さ

  // グリッド座標の半径をピクセル座標に変換
  let boundaryRadius = (GRID_WIDTH / 2 - 2) * cellWidth; 
  circle(width / 2, height / 2, boundaryRadius * 2); // circle関数は直径を取るため * 2
}

/**
 * マウスがクリックされたときに呼び出されるP5.jsのイベント関数
 * クリック位置にパルスを生成する（1回限り）
 */
function mouseClicked() {
  if (hasPulsed) {
    return; // 既にパルスが加えられていたら何もしない
  }

  // マウスのX座標をグリッドの列に変換
  let gridX = floor(mouseX / (width / GRID_WIDTH));
  // マウスのY座標をグリッドの行に変換
  let gridY = floor(mouseY / (height / GRID_HEIGHT));

  // クリック位置が有効なグリッド範囲内か、かつ円の内側かを確認
  let x_center_dist = gridX - GRID_WIDTH / 2;
  let y_center_dist = gridY - GRID_HEIGHT / 2;
  let distance_to_center = sqrt(x_center_dist * x_center_dist + y_center_dist * y_center_dist);

  if (gridX >= 0 && gridX < GRID_WIDTH && gridY >= 0 && gridY < GRID_HEIGHT && distance_to_center < GRID_WIDTH / 2 - 2) {
    // スライダーの値をパルス強度として使用
    let currentPulseAmplitude = pulseStrengthSlider.value();
    u_current[gridX][gridY] = currentPulseAmplitude;
    
    // 以前の変位をリセットし、新しいパルスがクリーンに伝播するようにする
    u_previous = create2DArray(GRID_WIDTH, GRID_HEIGHT);

    // パルスが加えられたことを記録
    hasPulsed = true; 
  }
}

/**
 * シミュレーションの状態を初期化する関数
 */
function resetSimulation() {
  // 2次元配列を初期化
  u_current = create2DArray(GRID_WIDTH, GRID_HEIGHT);
  u_previous = create2DArray(GRID_WIDTH, GRID_HEIGHT);
  
  // パルスがまだ加えられていない状態にリセット
  hasPulsed = false;

  // 画面をクリアして背景を黒にする
  background(0);
}


/**
 * 指定された列と行を持つ2次元配列を生成し、全て0で初期化するヘルパー関数
 * @param {number} cols - 列の数
 * @param {number} rows - 行の数
 * @returns {Array<Array<number>>} 初期化された2次元配列
 */
function create2DArray(cols, rows) {
  let arr = new Array(cols);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = new Array(rows).fill(0);
  }
  return arr;
}
