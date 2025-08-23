// シミュレーションのグリッドサイズ
const GRID_WIDTH = 120; 
const GRID_HEIGHT = 120; 

// 波の伝播速度の係数（この値を調整して、波の動きを変えてみよう）
// 安定性を確保するため、0.5以下に設定することが推奨されます。
const C_SQUARED = 0.45; 

// 減衰係数（0.0〜1.0の範囲、1.0に近いほど減衰が少ない）
// 0.995付近が、減衰と反射の両方を視認しやすい値です。
const DAMPING = 0.995;

// 指が膜を押さえる範囲の半径（グリッドセル単位）の最小値と最大値
const MIN_DYNAMIC_PRESS_RADIUS = 1; // 弱い力で押したときの半径
const MAX_DYNAMIC_PRESS_RADIUS = 7; // 強い力で押したときの半径
let dynamicFingerPressRadius = MIN_DYNAMIC_PRESS_RADIUS; // 動的に変わる指の押さえ半径

// 膜を叩く範囲の半径（グリッドセル単位）の最小値と最大値
const MIN_DYNAMIC_PULSE_RADIUS = 1; // 弱い力で叩いたときの半径
const MAX_DYNAMIC_PULSE_RADIUS = 5; // 強い力で叩いたときの半径
// dynamicPulseRadiusはmouseClicked内で計算するため、ここでは初期値のみ定義
// let dynamicPulseRadius = MIN_DYNAMIC_PULSE_RADIUS; // 動的に変わる叩く範囲の半径

// 膜の変位（高さ）を格納する2次元配列
let u_current;  // 現在の時刻の変位
let u_previous; // 1つ前の時刻の変位

// パルスのデフォルト強度
const DEFAULT_PULSE_AMPLITUDE = 200; 
// スライダーで設定可能なパルスの最大強度
const MAX_SLIDER_PULSE_AMPLITUDE = 500;
const MIN_SLIDER_PULSE_AMPLITUDE = 10;

let FIXED_LOG_MAX; // 色のマッピング基準となる固定の対数スケールの最大値

// === 指（固定点）とシミュレーションの状態管理用の変数 ===
let currentFixedPoint = null; // {x: gridX, y: gridY} または null (押さえの中心点)
// 指で押さえた点の初期変位値（負の値で凹むように）
let currentThumbPressValue = -100; // 指で押さえた時の初期変位量

let simulationState = 'SET_THUMB'; // 'SET_THUMB', 'TAP_MEMBRANE', 'NO_THUMB'

// UI要素の変数
let pulseStrengthSlider; 
let pulseStrengthLabel; 
let thumbPressStrengthSlider; // 指の強さスライダー
let thumbPressStrengthLabel;  // 指の強さラベル
let statusMessageLabel; // ユーザーへのメッセージ表示用
let resetButton;
let toggleThumbModeButton; // 新しいボタン


/**
 * P5.jsの初期設定を行う関数
 * キャンバスの作成、色モードの設定、配列の初期化など
 */
function setup() {
  // 描画領域をグリッドサイズの倍数で作成（例: 120x120グリッドなら240x240ピクセル）
  // .id()でCanvasにIDを付与し、CSSで中央配置できるようにする
  let canvasWidth = GRID_WIDTH * 2;  // 120 * 2 = 240
  let canvasHeight = GRID_HEIGHT * 2; // 120 * 2 = 240

  let canvas = createCanvas(canvasWidth, canvasHeight); 
  canvas.id('p5canvas'); // IDを付与

  pixelDensity(1); // 解像度を一定に保つ（Retinaディスプレイなどでピクセルが2倍になるのを防ぐ）
  noStroke();      // 図形の境界線を描画しない

  // 色空間をHSL（Hue, Saturation, Lightness）に設定
  // Hue: 0-360, Saturation: 0-100, Lightness: 0-100
  colorMode(HSL, 360, 100, 100); 

  // 色のマッピング基準となる固定の対数スケール最大値を計算
  // FIXED_LOG_MAXは、スライダーで設定可能な最大パルス強度に基づいて計算する
  // log(0)を避けるため +1 する
  FIXED_LOG_MAX = log(MAX_SLIDER_PULSE_AMPLITUDE + 1);
  // FIXED_LOG_MAXが0になるのを防ぐためのガード
  if (FIXED_LOG_MAX === 0) {
      FIXED_LOG_MAX = 1; 
  }

  // === UI要素の作成と初期配置 ===
  // Canvasの高さ（canvasHeight）＋ Canvasの上下マージン（20px*2）＋ 追加マージン
  const UI_INITIAL_Y_OFFSET = canvasHeight + 20 + 20 + 20; 
  let currentUIY = UI_INITIAL_Y_OFFSET;

  // 強度スライダーのラベル
  pulseStrengthLabel = createP('叩く強さ: ' + DEFAULT_PULSE_AMPLITUDE);
  // UI要素の幅を取得して中央寄せのX座標を計算
  pulseStrengthLabel.position((window.innerWidth - pulseStrengthLabel.elt.offsetWidth) / 2, currentUIY); 
  currentUIY += pulseStrengthLabel.elt.offsetHeight + 5; // 次の要素のY座標を更新

  // 強度スライダー
  pulseStrengthSlider = createSlider(MIN_SLIDER_PULSE_AMPLITUDE, MAX_SLIDER_PULSE_AMPLITUDE, DEFAULT_PULSE_AMPLITUDE);
  pulseStrengthSlider.style('width', '150px'); 
  pulseStrengthSlider.position((window.innerWidth - pulseStrengthSlider.elt.offsetWidth) / 2, currentUIY); 
  currentUIY += pulseStrengthSlider.elt.offsetHeight + 15; // 次の要素のY座標を更新

  // 指の強さスライダーのラベル
  thumbPressStrengthLabel = createP('指で押す強さ: ' + abs(currentThumbPressValue)); // 絶対値で表示
  thumbPressStrengthLabel.position((window.innerWidth - thumbPressStrengthLabel.elt.offsetWidth) / 2, currentUIY); 
  currentUIY += thumbPressStrengthLabel.elt.offsetHeight + 5; // 次の要素のY座標を更新

  // 指の強さスライダー
  thumbPressStrengthSlider = createSlider(10, 200, abs(currentThumbPressValue)); // 10から200の範囲で設定可能（絶対値）
  thumbPressStrengthSlider.style('width', '150px');
  thumbPressStrengthSlider.position((window.innerWidth - thumbPressStrengthSlider.elt.offsetWidth) / 2, currentUIY); 
  thumbPressStrengthSlider.input(updateThumbPressValue);
  currentUIY += thumbPressStrengthSlider.elt.offsetHeight + 15; // 次の要素のY座標を更新

  // 初回ロード時に動的な指の半径を計算
  dynamicFingerPressRadius = round(map(abs(currentThumbPressValue), float(thumbPressStrengthSlider.elt.min), float(thumbPressStrengthSlider.elt.max), MIN_DYNAMIC_PRESS_RADIUS, MAX_DYNAMIC_PRESS_RADIUS));

  // リセットボタン
  resetButton = createButton('シミュレーションをリセット'); 
  resetButton.position((window.innerWidth - resetButton.elt.offsetWidth) / 2, currentUIY); 
  resetButton.mousePressed(resetSimulation);
  currentUIY += resetButton.elt.offsetHeight + 10; // 次の要素のY座標を更新

  // 新しいボタン: 指モード切り替え
  toggleThumbModeButton = createButton('指モード切替');
  toggleThumbModeButton.position((window.innerWidth - toggleThumbModeButton.elt.offsetWidth) / 2, currentUIY); 
  toggleThumbModeButton.mousePressed(toggleThumbMode);
  currentUIY += toggleThumbModeButton.elt.offsetHeight + 10; // 次の要素のY座標を更新

  // ステータスメッセージラベル
  statusMessageLabel = createP(''); // 初期メッセージはresetSimulationで設定
  statusMessageLabel.style('color', '#FFD700'); // 目立つ色に
  statusMessageLabel.position((window.innerWidth - statusMessageLabel.elt.offsetWidth) / 2, currentUIY); 

  // シミュレーションを初期化 (statusMessageLabelが初期化された後に呼び出す)
  resetSimulation(); 
}

/**
 * 指の強さスライダーの値が変更されたときに呼び出される関数
 */
function updateThumbPressValue() {
    // スライダーの値は正の数なので、指が凹むように負の数にする
    currentThumbPressValue = -thumbPressStrengthSlider.value();
    thumbPressStrengthLabel.html('指で押す強さ: ' + abs(currentThumbPressValue));
    // UI要素を中央寄せするため、位置も更新
    thumbPressStrengthLabel.position((window.innerWidth - thumbPressStrengthLabel.elt.offsetWidth) / 2, thumbPressStrengthLabel.y);


    // スライダーの値に基づいて動的な指の押さえ半径を計算
    dynamicFingerPressRadius = round(map(abs(currentThumbPressValue), float(thumbPressStrengthSlider.elt.min), float(thumbPressStrengthSlider.elt.max), MIN_DYNAMIC_PRESS_RADIUS, MAX_DYNAMIC_PRESS_RADIUS));

    // 指モードで、すでに指が設定されている場合は、即座に膜の変位を更新
    if (simulationState === 'TAP_MEMBRANE' && currentFixedPoint) {
        setInitialStaticDeformation(); // 静的変形を再計算
    }
}


/**
 * P5.jsの描画ループ関数
 * 毎フレーム、シミュレーションの計算と描画を行う
 */
function draw() {
  background(0); // 背景を黒に変更して、膜を際立たせる

  // スライダーの現在の値をラベルに表示
  pulseStrengthLabel.html('叩く強さ: ' + pulseStrengthSlider.value());
  // UI要素を中央寄せするため、位置も更新
  pulseStrengthLabel.position((window.innerWidth - pulseStrengthLabel.elt.offsetWidth) / 2, pulseStrengthLabel.y);


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
      if (distance < GRID_WIDTH / 2 - 2) { // GRID_WIDTH / 2 - 2 はシミュレーション空間の半径
        // 指の押さえ範囲内の場合は計算をスキップし、後で強制的に変位を設定する
        if (currentFixedPoint && dist(i, j, currentFixedPoint.x, currentFixedPoint.y) <= dynamicFingerPressRadius) {
            u_next[i][j] = currentThumbPressValue; // ここでは仮の値、drawの最後で再度固定
            continue; // この点の通常の物理計算はスキップ
        }

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
  u_previous = u_current;
  u_current = u_next;

  // === 固定点がある場合、その変位を強制的にcurrentThumbPressValueに固定する ===
  // これにより、指で押さえられた点がその変位を維持し、そこから波が伝播する
  if (currentFixedPoint) {
    for (let i = max(0, currentFixedPoint.x - dynamicFingerPressRadius); i < min(GRID_WIDTH, currentFixedPoint.x + dynamicFingerPressRadius + 1); i++) {
        for (let j = max(0, currentFixedPoint.y - dynamicFingerPressRadius); j < min(GRID_HEIGHT, currentFixedPoint.y + dynamicFingerPressRadius + 1); j++) {
            if (dist(i, j, currentFixedPoint.x, currentFixedPoint.y) <= dynamicFingerPressRadius) {
                u_current[i][j] = currentThumbPressValue;
                u_previous[i][j] = currentThumbPressValue; // 以前の変位も固定することで、安定した波を生成
            }
        }
    }
  }
  // === 固定点処理ここまで ===

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
          // 指の変位を基準に相対的な変位の絶対値を取る
          let displayVal = abs(val - (currentFixedPoint && dist(i, j, currentFixedPoint.x, currentFixedPoint.y) <= dynamicFingerPressRadius ? currentThumbPressValue : 0));
          
          let logVal = log(displayVal + 1);
          
          let hue = 0;      // 色相
          let saturation = 0; // 彩度
          let lightness = 0; // 明度

          // 彩度を対数スケールでマッピング（0から100）
          saturation = map(logVal, 0, FIXED_LOG_MAX, 0, 100);
          saturation = constrain(saturation, 0, 100); // 0-100の範囲に制限

          // 明度を対数スケールでマッピング（0から95：真っ暗からより明るい色へ）
          lightness = map(logVal, 0, FIXED_LOG_MAX, 0, 95); 
          lightness = constrain(lightness, 0, 100); // 0-100の範囲に制限
          
          // 変位の符号に応じて色相を設定
          if (val > (currentFixedPoint && dist(i, j, currentFixedPoint.x, currentFixedPoint.y) <= dynamicFingerPressRadius ? currentThumbPressValue : 0)) {
              hue = 0; // 正の変位は赤（Hue 0）
          } else if (val < (currentFixedPoint && dist(i, j, currentFixedPoint.x, currentFixedPoint.y) <= dynamicFingerPressRadius ? currentThumbPressValue : 0)) {
              hue = 240; // 負の変位は青（Hue 240）
          } else {
              // 変位が完全にゼロの場合
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

  // === 指（固定点）の視覚的な表示 ===
  if (currentFixedPoint) {
    let px_x = currentFixedPoint.x * cellWidth + cellWidth / 2;
    let px_y = currentFixedPoint.y * cellHeight + cellHeight / 2;
    fill(120, 100, 50, 80); // 指は半透明の緑で表示 (HSL: 色相120=緑、彩度100、明度50、透明度80)
    noStroke();
    circle(px_x, px_y, (dynamicFingerPressRadius * 2 + 1) * cellWidth * 0.7); // 指の押さえ範囲を反映した円で表示
  }
  // === 指の表示ここまで ===
}

/**
 * マウスがクリックされたときに呼び出されるP5.jsのイベント関数
 * クリック位置に基づいて指の設定または波の生成を行う
 */
function mouseClicked() {
  // クリック可能な領域かを判断するための変数
  let gridX = floor(mouseX / (width / GRID_WIDTH));
  let gridY = floor(mouseY / (height / GRID_HEIGHT));

  let x_center_canvas = map(gridX, 0, GRID_WIDTH, 0, width);
  let y_center_canvas = map(gridY, 0, GRID_HEIGHT, 0, height);

  let x_dist_from_center = x_center_canvas - width / 2;
  let y_dist_from_center = y_center_canvas - height / 2;
  let distance_from_center_px = sqrt(x_dist_from_center * x_dist_from_center + y_dist_from_center * y_dist_from_center);

  let max_tap_radius_px = (GRID_WIDTH / 2 - 2) * (width / GRID_WIDTH);


  if (gridX >= 0 && gridX < GRID_WIDTH && gridY >= 0 && gridY < GRID_HEIGHT && distance_from_center_px < max_tap_radius_px) {
    if (simulationState === 'SET_THUMB') {
      // 指の位置を設定
      currentFixedPoint = {x: gridX, y: gridY};
      simulationState = 'TAP_MEMBRANE';
      
      // 指設定後、膜を静止状態から指で押された初期変形状態に設定
      setInitialStaticDeformation(); 
      statusMessageLabel.html(`指の位置を設定しました: (${gridX}, ${gridY})。膜をタップして振動させてください。`);
    } else if (simulationState === 'TAP_MEMBRANE') {
      // 指の位置が設定済みの場合、膜を叩く
      // 指が押さえられている範囲を叩いた場合は、振動は開始しないがメッセージは出す
      if (currentFixedPoint && dist(gridX, gridY, currentFixedPoint.x, currentFixedPoint.y) <= dynamicFingerPressRadius) {
        statusMessageLabel.html(`指の固定点内 (${currentFixedPoint.x}, ${currentFixedPoint.y}) は固定されています。他の場所を叩いてください。`);
        return; // 指の場所を叩いても波は発生させない
      }

      // 叩く強さに応じて動的な叩く範囲を計算
      let currentPulseAmplitude = pulseStrengthSlider.value();
      let dynamicPulseRadius = round(map(currentPulseAmplitude, float(pulseStrengthSlider.elt.min), float(pulseStrengthSlider.elt.max), MIN_DYNAMIC_PULSE_RADIUS, MAX_DYNAMIC_PULSE_RADIUS));

      // 叩かれた範囲に変位を加算
      for (let i = max(0, gridX - dynamicPulseRadius); i < min(GRID_WIDTH, gridX + dynamicPulseRadius + 1); i++) {
          for (let j = max(0, gridY - dynamicPulseRadius); j < min(GRID_HEIGHT, gridY + dynamicPulseRadius + 1); j++) {
              if (dist(i, j, gridX, gridY) <= dynamicPulseRadius) {
                  u_current[i][j] += currentPulseAmplitude;
                  // 変位が過度に大きくなりすぎないように制限
                  u_current[i][j] = constrain(u_current[i][j], -MAX_SLIDER_PULSE_AMPLITUDE * 2, MAX_SLIDER_PULSE_AMPLITUDE * 2); 
              }
          }
      }

      statusMessageLabel.html(`膜を叩きました: (${gridX}, ${gridY})。`);
    } else if (simulationState === 'NO_THUMB') {
        // 指モードではない場合、常に新しいパルスを生成する
        let currentPulseAmplitude = pulseStrengthSlider.value();
        let dynamicPulseRadius = round(map(currentPulseAmplitude, float(pulseStrengthSlider.elt.min), float(pulseStrengthSlider.elt.max), MIN_DYNAMIC_PULSE_RADIUS, MAX_DYNAMIC_PULSE_RADIUS));

        // 叩かれた範囲に変位を加算
        for (let i = max(0, gridX - dynamicPulseRadius); i < min(GRID_WIDTH, gridX + dynamicPulseRadius + 1); i++) {
            for (let j = max(0, gridY - dynamicPulseRadius); j < min(GRID_HEIGHT, gridY + dynamicPulseRadius + 1); j++) {
                if (dist(i, j, gridX, gridY) <= dynamicPulseRadius) {
                    u_current[i][j] += currentPulseAmplitude;
                    // 変位が過度に大きくなりすぎないように制限
                    u_current[i][j] = constrain(u_current[i][j], -MAX_SLIDER_PULSE_AMPLITUDE * 2, MAX_SLIDER_PULSE_AMPLITUDE * 2); 
                }
            }
        }
        statusMessageLabel.html(`膜を叩きました: (${gridX}, ${gridY})。指モードを切り替えるには「指モード切替」ボタンを押してください。`);
    }
  }
}

/**
 * 指モードを切り替える関数
 */
function toggleThumbMode() {
    if (simulationState === 'NO_THUMB') {
        // 現在指なしモードなら、指設定モードに戻す
        resetSimulation(); // 完全リセットし、SET_THUMBに戻る
    } else {
        // 現在指設定済みモードまたは指設定モードなら、指なしモードにする
        currentFixedPoint = null; // 指を解除
        simulationState = 'NO_THUMB'; // モードを切り替える
        // 指を解除した状態なので、完全にクリアする
        u_current = create2DArray(GRID_WIDTH, GRID_HEIGHT);
        u_previous = create2DArray(GRID_WIDTH, GRID_HEIGHT);
        background(0); // 画面もクリア
        statusMessageLabel.html('指モードOFF。膜をタップして振動させてください。');
    }
}

/**
 * シミュレーションの状態を完全にリセットする関数（指の位置もリセット）
 * 初期状態（指を設定するモード）に戻る
 */
function resetSimulation() {
  // 2次元配列を初期化
  u_current = create2DArray(GRID_WIDTH, GRID_HEIGHT);
  u_previous = create2DArray(GRID_WIDTH, GRID_HEIGHT);
  
  currentFixedPoint = null; // 指の位置もクリア
  simulationState = 'SET_THUMB'; // 状態を初期モードに戻す
  
  // 画面をクリアして背景を黒にする
  background(0);
  // statusMessageLabel が undefined の場合は、メッセージを設定しないようにする
  if (statusMessageLabel) { 
    statusMessageLabel.html('シミュレーションをリセットしました。指の位置を設定してください。');
  }
}

/**
 * 現在の波をクリアし、初期静的変形状態（指が押さえている場合はその形）に戻す関数
 * (TAP_MEMBRANEモードで指の変形状態は維持しつつ波だけをリセットする場合に使用)
 */
function clearCurrentWaves() {
    // 2次元配列を初期化
    u_current = create2DArray(GRID_WIDTH, GRID_HEIGHT);
    u_previous = create2DArray(GRID_WIDTH, GRID_HEIGHT);

    // 指が設定されている場合は、その初期静的変形状態を計算して適用
    if (currentFixedPoint) {
        setInitialStaticDeformation();
    } else {
        // 指が設定されていない場合は、すべて0に初期化
        // （create2DArrayで既に0になっているため、ここでは特に何もする必要はない）
    }
    // 画面をクリアして背景を黒にする
    background(0);
}

/**
 * 指で押さえられた状態の初期静的変位を計算し、膜に適用する関数
 * (緩和法を用いて滑らかな変形を生成)
 */
function setInitialStaticDeformation() {
    // まず配列をゼロで初期化
    u_current = create2DArray(GRID_WIDTH, GRID_HEIGHT);
    u_previous = create2DArray(GRID_WIDTH, GRID_HEIGHT);

    // 指の固定点が存在する場合のみ処理
    if (currentFixedPoint) {
        // 指の押さえ範囲を考慮して初期変位を設定
        for (let i = max(0, currentFixedPoint.x - dynamicFingerPressRadius); i < min(GRID_WIDTH, currentFixedPoint.x + dynamicFingerPressRadius + 1); i++) {
            for (let j = max(0, currentFixedPoint.y - dynamicFingerPressRadius); j < min(GRID_HEIGHT, currentFixedPoint.y + dynamicFingerPressRadius + 1); j++) {
                // 中心からの距離が半径内であれば変位を固定
                if (dist(i, j, currentFixedPoint.x, currentFixedPoint.y) <= dynamicFingerPressRadius) {
                    u_current[i][j] = currentThumbPressValue;
                    u_previous[i][j] = currentThumbPressValue;
                }
            }
        }
    }

    const RELAXATION_ITERATIONS = 300; // 緩和計算の繰り返し回数。大きいほど滑らかになるが重くなる。

    for (let iter = 0; iter < RELAXATION_ITERATIONS; iter++) {
        let temp_u = create2DArray(GRID_WIDTH, GRID_HEIGHT); // 次のイテレーション用の一時配列

        for (let i = 0; i < GRID_WIDTH; i++) {
            for (let j = 0; j < GRID_HEIGHT; j++) {
                let x_center_dist = i - GRID_WIDTH / 2;
                let y_center_dist = j - GRID_HEIGHT / 2;
                let distance_to_boundary = sqrt(x_center_dist * x_center_dist + y_center_dist * y_center_dist);

                // 円形境界の内側かつ、指の固定範囲ではない場合のみ緩和計算を行う
                if (distance_to_boundary < GRID_WIDTH / 2 - 2) { 
                    if (currentFixedPoint && dist(i, j, currentFixedPoint.x, currentFixedPoint.y) <= dynamicFingerPressRadius) {
                        temp_u[i][j] = currentThumbPressValue; // 指の押さえ範囲内は常に固定
                    } else {
                        // 周囲4点の平均を取る（単純な緩和法）
                        let sumNeighbors = 0;
                        let countNeighbors = 0;
                        // 境界チェックをしつつ、隣接点の値を加算
                        if (i > 0) { sumNeighbors += u_current[i-1][j]; countNeighbors++; }
                        if (i < GRID_WIDTH - 1) { sumNeighbors += u_current[i+1][j]; countNeighbors++; }
                        if (j > 0) { sumNeighbors += u_current[i][j-1]; countNeighbors++; }
                        if (j < GRID_HEIGHT - 1) { sumNeighbors += u_current[i][j+1]; countNeighbors++; }
                        
                        if (countNeighbors > 0) {
                            temp_u[i][j] = sumNeighbors / countNeighbors;
                        } else {
                            // 隣接点がない（角など）場合は現在の値を維持（実際にはほとんど起こらない）
                            temp_u[i][j] = u_current[i][j]; 
                        }
                    }
                } else {
                    temp_u[i][j] = 0; // 円形境界の外側は常に0
                }
            }
        }
        u_current = temp_u; // 計算結果をu_currentに反映
    }
    // u_previousも同じ初期静止状態に設定し、初期速度をゼロにする
    u_previous = JSON.parse(JSON.stringify(u_current)); // ディープコピー
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
