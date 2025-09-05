import { Camera } from '@mediapipe/camera_utils';
import { FaceMesh, Results } from '@mediapipe/face_mesh';
import {
  LocalDataStream,
  LocalP2PRoomMember,
  RemoteVideoStream,
  RoomSubscription,
  SkyWayStreamFactory,
} from '@skyway-sdk/room';
import {
  CSSProperties,
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSpeechRecognition } from 'react-speech-recognition';

// --- Constant Valuale ---
const AppConstants = {
  MOVING_AVERAGE_FRAME: 10, // 移動平均計算時のフレーム数
  WIDTH_MAX: 1000, // ビデオウィンドウの大きさの最大値
  WIDTH_MIN: 800, // ビデオウィンドウの大きさの最小値
  DISTANCE_RATE_MOVE: 10000, // 位置の移動を行う場合の，スクリーンの中心からのずれの拡大率
  DEFAULT_TOP_DIFF: 0, // 位置の移動を行う場合の，スクリーンの中心からの上下方向のずれ
  DEFAULT_LEFT_DIFF: 0, // 位置の移動を行う場合の，スクリーンの中心からの左右方向のずれ
  BORDER_ALPHA_MIN: 0, // ビデオウィンドウの枠の色の透明度の最小値
  BORDER_ALPHA_MAX: 1, // ビデオウィンドウの枠の色の透明度の最大値
  BORDER_ALPHA_MIN_THRESHOLD: 0.015, // ビデオウィンドウの枠の色を完全に透明にする時の閾値
  DEFAULT_MY_WINDOW_WIDTH: 250, // 自分自身のビデオウィンドウの大きさのデフォルト値
  VOLUME_THRESHOLD: 10, // 発話と判定するボリュームの閾値（0-255，要調整）
  SPEAKING_DEBOUNCE_MS: 200, // 発話開始/終了の判定を安定させるためのデバウンス時間
  BORDER_COLORS: {
    GREEN: { r: 83, g: 253, b: 49, a: 0 }, // ビデオウィンドウの枠の色（緑色）
    BLACK: { r: 0, g: 0, b: 0, a: 0 }, // ビデオウィンドウの枠の色（黒色）
    RED: { r: 255, g: 0, b: 0, a: 0 }, // ビデオウィンドウの枠の色（赤色）
  },
};
const defaultWidth = (AppConstants.WIDTH_MAX + AppConstants.WIDTH_MIN) / 2; // ビデオウィンドウの大きさのデフォルト値（参加者・対話相手共通）
const defaultBorderColor = AppConstants.BORDER_COLORS.GREEN; // ビデオウィンドウの枠の色のデフォルト値（参加者・対話相手共通）

interface WindowAndAudioAndParticipantsInfo {
  topDiff: number;
  leftDiff: number;
  width: number;
  height: number;
  borderRed: number;
  borderGreen: number;
  borderBlue: number;
  borderAlpha: number;
  borderAlphaValueBasedVoice: number;
  theta: number;
  widthInCaseOfChange: number;
  isSpeaking: boolean;
  transcript: string;
  gazeStatus: string;
}

// --- Utility Functions ---
const Utils = {
  // 数値型リストの要素の平均値を求める関数
  averageValue: (
    numberList: number[],
    startId = 0,
    endId: number = numberList.length - 1
  ) => {
    let sum = 0; // 引数のリスト内の要素の合計値
    for (let i = startId; i < endId + 1; i++) {
      sum += numberList[i];
    }
    return sum / (endId - startId + 1);
  },
  // 2つのベクトル（数値型リスト）の内積を求める関数
  inner: (numberList1: number[], numberList2: number[]) => {
    return numberList1[0] * numberList2[0] + numberList1[1] * numberList2[1];
  },
  // ベクトル（数値型リスト）の長さを求める関数
  norm: (numberList: number[]) => {
    return Math.sqrt(
      numberList[0] * numberList[0] + numberList[1] * numberList[1]
    );
  },
  // 参加者の視線方向を求める関数
  getParticipantDirection: (theta: number) => {
    if (theta < 0 || theta > 360) return 'Error';

    // 参加者の視線方向を識別
    if (theta < 22.5 || theta >= 337.5) return 'Left';
    else if (theta >= 22.5 && theta < 67.5) return 'LeftDown';
    else if (theta >= 67.5 && theta < 112.5) return 'Down';
    else if (theta >= 112.5 && theta < 157.5) return 'RightDown';
    else if (theta >= 157.5 && theta < 202.5) return 'Right';
    else if (theta >= 202.5 && theta < 247.5) return 'RightUp';
    else if (theta >= 247.5 && theta < 292.5) return 'Up';
    else if (theta >= 292.5 && theta < 337.5) return 'LeftUp';
    else return 'Error';
  },
};

// --- Global Variables（以下すべてuseStateで管理したいが，やり方が分かっていないので，保留） ---
// const scrollMyX = window.scrollX; // 自分自身（参加者側）のスクロール位置（X座標）
const moveWidths: number[] = []; // ビデオウィンドウの大きさの移動平均を計算するためのリスト
const moveBorderAlphas: number[] = []; // ビデオウィンドウの枠の色の透明度の移動平均を計算するためのリスト
const isSpeaking = false; // 発話状態か否か
const borderAlphaValueBasedVoice = AppConstants.BORDER_ALPHA_MIN; // 発話タイミングに基づく，枠の色の透明度変化を表す値

// --- Component Logic ---
export const Video: FC<{
  subscription: RoomSubscription<RemoteVideoStream>;
  windowInfo?: WindowAndAudioAndParticipantsInfo;
  participantNum: number;
  // isMe: boolean;
  // me?: LocalP2PRoomMember;
  // conditionID: number;
}> = ({ subscription, windowInfo, participantNum }) => {
  // --- States ---
  // const [localDataStream, setLocalDataStream] = useState<LocalDataStream>();
  // const [
  //   myWindowAndAudioAndParticipantsInfo,
  //   setMyWindowAndAudioAndParticipantsInfo,
  // ] = useState<WindowAndAudioAndParticipantsInfo>({
  //   topDiff: AppConstants.DEFAULT_TOP_DIFF,
  //   leftDiff: AppConstants.DEFAULT_LEFT_DIFF,
  //   width: defaultWidth,
  //   height: defaultWidth,
  //   borderRed: defaultBorderColor.r,
  //   borderGreen: defaultBorderColor.g,
  //   borderBlue: defaultBorderColor.b,
  //   borderAlpha: defaultBorderColor.a,
  //   borderAlphaValueBasedVoice: borderAlphaValueBasedVoice,
  //   widthInCaseOfChange: 0,
  //   theta: 0,
  //   isSpeaking: false,
  //   transcript: '',
  //   gazeStatus: '',
  // }); // 自分自身のウィンドウの情報
  // const { transcript, resetTranscript, browserSupportsSpeechRecognition } =
  //   useSpeechRecognition(); // 音声認識設定

  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  // const resultsRef = useRef<Results>(); // MediaPipeの検出結果を格納するための参照

  // --- Callbacks ---
  // const updateWindowInfo = useCallback(
  //   (
  //     conditionID: number,
  //     fc_d_from_fc_vector: number[],
  //     rad_head_direction: number,
  //     theta_head_direction: number,
  //     borderAlphaValueBasedVoice: number,
  //     status: boolean,
  //     text: string
  //   ): WindowAndAudioAndParticipantsInfo => {
  //     //  --- Variables ---
  //     let next_width_rate = 0; // ウィンドウの大きさの最大値に対する，実際のウィンドウの大きさの比率
  //     let next_border_a_rate = 0; // ビデオウィンドウの枠の色の透明度の比率
  //     let width_value = defaultWidth; // ビデオウィンドウの大きさ
  //     let border_a_value = AppConstants.BORDER_ALPHA_MIN; // ビデオウィンドウの枠の色の透明度
  //     let myWindowWidthTmpValue = 0; // ビデオウィンドウの大きさ（保存・分析用）
  //     let width_value_discrete = AppConstants.WIDTH_MIN; // 離散変化時のビデオウィンドウの大きさ
  //     let gazeStatus = ''; // 参加者の視線状態（注視状態 or 視線回避状態）
  //     const top_diff_value =
  //       AppConstants.DISTANCE_RATE_MOVE *
  //       Utils.norm(fc_d_from_fc_vector) *
  //       Math.sin(rad_head_direction); // スクリーンの中心からの上下方向のずれ
  //     const left_diff_value =
  //       AppConstants.DISTANCE_RATE_MOVE *
  //       Utils.norm(fc_d_from_fc_vector) *
  //       Math.cos(rad_head_direction - Math.PI); // スクリーンの中心からの左右方向のずれ
  //     let newInfo: WindowAndAudioAndParticipantsInfo; // ビデオウィンドウの情報をまとめたデータ

  //     // ウィンドウの大きさ・ビデオウィンドウの枠の色の透明度の計算
  //     if (150 * Utils.norm(fc_d_from_fc_vector) <= 1) {
  //       next_width_rate = 1;
  //       next_border_a_rate = 1;
  //     } else {
  //       next_width_rate = 1 / (150 * Utils.norm(fc_d_from_fc_vector));
  //       next_border_a_rate = 1 / (150 * Utils.norm(fc_d_from_fc_vector));
  //     }
  //     width_value = AppConstants.WIDTH_MAX * next_width_rate;
  //     border_a_value = AppConstants.BORDER_ALPHA_MAX * next_border_a_rate;

  //     // ウィンドウの大きさ・ビデオウィンドウの枠の色の透明度が最小値を下回らないようにする
  //     if (width_value < AppConstants.WIDTH_MIN)
  //       width_value = AppConstants.WIDTH_MIN;
  //     if (border_a_value < AppConstants.BORDER_ALPHA_MIN_THRESHOLD)
  //       border_a_value = AppConstants.BORDER_ALPHA_MIN;

  //     myWindowWidthTmpValue = width_value; // ウィンドウサイズの一時保存（大きさを変更しない条件でも分析できるようにするため）

  //     // 移動平均の計算 + リストの肥大化の防止（ビデオウィンドウの大きさ・ビデオウィンドウの枠の色の透明度）
  //     moveWidths.push(width_value);
  //     moveBorderAlphas.push(border_a_value);
  //     if (moveWidths.length < AppConstants.MOVING_AVERAGE_FRAME)
  //       width_value = Utils.averageValue(moveWidths, 0, moveWidths.length - 1);
  //     else {
  //       if (moveWidths.length > AppConstants.MOVING_AVERAGE_FRAME + 3)
  //         moveWidths.shift();
  //       width_value = Utils.averageValue(
  //         moveWidths,
  //         moveWidths.length - AppConstants.MOVING_AVERAGE_FRAME,
  //         moveWidths.length - 1
  //       );
  //     }
  //     if (moveBorderAlphas.length < AppConstants.MOVING_AVERAGE_FRAME)
  //       border_a_value = Utils.averageValue(
  //         moveBorderAlphas,
  //         0,
  //         moveBorderAlphas.length - 1
  //       );
  //     else {
  //       if (moveBorderAlphas.length > AppConstants.MOVING_AVERAGE_FRAME + 3)
  //         moveBorderAlphas.shift();
  //       border_a_value = Utils.averageValue(
  //         moveBorderAlphas,
  //         moveBorderAlphas.length - AppConstants.MOVING_AVERAGE_FRAME,
  //         moveBorderAlphas.length - 1
  //       );
  //     }

  //     // 離散変化時のビデオウィンドウの大きさの計算
  //     if (
  //       width_value >
  //       AppConstants.WIDTH_MAX -
  //         (AppConstants.WIDTH_MAX - AppConstants.WIDTH_MIN) * 0.1
  //     ) {
  //       width_value_discrete = AppConstants.WIDTH_MAX; // 最大サイズ
  //     } else width_value_discrete = AppConstants.WIDTH_MIN; // 最小サイズ

  //     // 参加者の視線状態（注視状態 or 視線回避状態）の算出
  //     if (
  //       myWindowWidthTmpValue >
  //       AppConstants.WIDTH_MAX -
  //         (AppConstants.WIDTH_MAX - AppConstants.WIDTH_MIN) * 0.1
  //     ) {
  //       gazeStatus = 'mutual gaze';
  //     } // ビデオウィンドウの大きさが最大値の10%以内の時には，注視状態であると判断する
  //     if (
  //       myWindowWidthTmpValue <
  //       AppConstants.WIDTH_MIN +
  //         (AppConstants.WIDTH_MAX - AppConstants.WIDTH_MIN) * 0.1
  //     ) {
  //       gazeStatus = 'gaze aversion';
  //     } // ビデオウィンドウの大きさが最小値の10%以内の時には，視線回避状態であると判断する

  //     // ビデオウィンドウの情報をまとめたデータの作成
  //     const baseInfo = {
  //       borderRed: defaultBorderColor.r,
  //       borderGreen: defaultBorderColor.g,
  //       borderBlue: defaultBorderColor.b,
  //       borderAlphaValueBasedVoice: borderAlphaValueBasedVoice,
  //       widthInCaseOfChange: myWindowWidthTmpValue,
  //       theta: theta_head_direction,
  //       isSpeaking: status,
  //       transcript: text,
  //       gazeStatus: gazeStatus,
  //     }; // ビデオウィンドウの情報のベースデータ

  //     switch (conditionID) {
  //       case 1: // Baseline条件
  //         newInfo = {
  //           ...baseInfo,
  //           topDiff: AppConstants.DEFAULT_TOP_DIFF,
  //           leftDiff: AppConstants.DEFAULT_LEFT_DIFF,
  //           width: defaultWidth,
  //           height: defaultWidth,
  //           borderAlpha: borderAlphaValueBasedVoice,
  //         };
  //         break;
  //       case 2: // FrameChange条件
  //         newInfo = {
  //           ...baseInfo,
  //           topDiff: AppConstants.DEFAULT_TOP_DIFF,
  //           leftDiff: AppConstants.DEFAULT_LEFT_DIFF,
  //           width: defaultWidth,
  //           height: defaultWidth,
  //           borderAlpha: border_a_value,
  //         };
  //         break;
  //       case 3: // SizeChange条件
  //         newInfo = {
  //           ...baseInfo,
  //           topDiff: AppConstants.DEFAULT_TOP_DIFF,
  //           leftDiff: AppConstants.DEFAULT_LEFT_DIFF,
  //           width: width_value,
  //           height: width_value,
  //           borderAlpha: borderAlphaValueBasedVoice,
  //         };
  //         break;
  //       case 4: // SizeChange_Discrete条件
  //         newInfo = {
  //           ...baseInfo,
  //           topDiff: AppConstants.DEFAULT_TOP_DIFF,
  //           leftDiff: AppConstants.DEFAULT_LEFT_DIFF,
  //           width: width_value_discrete,
  //           height: width_value_discrete,
  //           borderAlpha: borderAlphaValueBasedVoice,
  //         };
  //         break;
  //       case 5: // PositionChange条件
  //         newInfo = {
  //           ...baseInfo,
  //           topDiff: top_diff_value,
  //           leftDiff: left_diff_value,
  //           width: defaultWidth,
  //           height: defaultWidth,
  //           borderAlpha: borderAlphaValueBasedVoice,
  //         };
  //         break;
  //       case 6: // PositionAndSizeChange条件
  //         newInfo = {
  //           ...baseInfo,
  //           topDiff: top_diff_value,
  //           leftDiff: left_diff_value,
  //           width: width_value,
  //           height: width_value,
  //           borderAlpha: borderAlphaValueBasedVoice,
  //         };
  //         break;
  //       default: // Baseline条件
  //         newInfo = {
  //           ...baseInfo,
  //           topDiff: AppConstants.DEFAULT_TOP_DIFF,
  //           leftDiff: AppConstants.DEFAULT_LEFT_DIFF,
  //           width: defaultWidth,
  //           height: defaultWidth,
  //           borderAlpha: borderAlphaValueBasedVoice,
  //         };
  //     }

  //     return newInfo; // ビデオウィンドウの情報を返す
  //   },
  //   []
  // );
  // const onResults = useCallback((results: Results) => {
  //   // 顔の座標が正しく取得できている時のみ実行
  //   if (results.multiFaceLandmarks.length > 0) {
  //     // 検出結果の格納
  //     resultsRef.current = results;

  //     // 頭部方向の取得
  //     const landmarks_pos_x: number[] = []; // 468個の点のx座標を格納するリスト
  //     const landmarks_pos_y: number[] = []; // 468個の点のy座標を格納するリスト
  //     const face_center_default_pos: number[] = []; // 正面を向いた時の顔の中心点（ここでは，飯塚さんの修論に倣って，鼻の先の座標としている．）
  //     if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
  //       for (let id = 0; id < results.multiFaceLandmarks[0].length; id++) {
  //         // 特定の顔の点を取得（x座標）
  //         if (results.multiFaceLandmarks[0][id].x < 0) landmarks_pos_x.push(0);
  //         else if (results.multiFaceLandmarks[0][id].x > 1)
  //           landmarks_pos_x.push(1);
  //         else landmarks_pos_x.push(results.multiFaceLandmarks[0][id].x);

  //         // 特定の顔の点を取得（y座標）
  //         if (results.multiFaceLandmarks[0][id].y < 0) landmarks_pos_y.push(0);
  //         else if (results.multiFaceLandmarks[0][id].y > 1)
  //           landmarks_pos_y.push(1);
  //         else landmarks_pos_y.push(results.multiFaceLandmarks[0][id].y);

  //         // 正面を向いた時の顔の中心点を取得（x，y座標）
  //         if (id === 1) {
  //           // x座標
  //           if (results.multiFaceLandmarks[0][id].x < 0)
  //             face_center_default_pos.push(0);
  //           else if (results.multiFaceLandmarks[0][id].x > 1)
  //             face_center_default_pos.push(1);
  //           else
  //             face_center_default_pos.push(results.multiFaceLandmarks[0][id].x);

  //           // y座標
  //           if (results.multiFaceLandmarks[0][id].y < 0)
  //             face_center_default_pos.push(0);
  //           else if (results.multiFaceLandmarks[0][id].y > 1)
  //             face_center_default_pos.push(1);
  //           else
  //             face_center_default_pos.push(results.multiFaceLandmarks[0][id].y);
  //         }
  //       }
  //     }
  //     // 顔の中心点の座標
  //     const face_center_pos = [
  //       Utils.averageValue(landmarks_pos_x),
  //       Utils.averageValue(landmarks_pos_y),
  //     ];
  //     const base_vector = [1, 0]; // 頭部方向を計算するためのベクトル
  //     const fc_d_from_fc_vector = [
  //       face_center_default_pos[0] - face_center_pos[0],
  //       face_center_default_pos[1] - face_center_pos[1],
  //     ]; // 顔の中心点を原点とした時の，正面を向いた際の顔の中心点のベクトル
  //     let rad_head_direction = Math.acos(
  //       Utils.inner(base_vector, fc_d_from_fc_vector) /
  //         (Utils.norm(base_vector) * Utils.norm(fc_d_from_fc_vector))
  //     ); // 頭部方向（ラジアン）
  //     let theta_head_direction = rad_head_direction * (180 / Math.PI); // 頭部方向（度）
  //     // arccosの値域が0～πであるため，上下の区別をするために，上を向いている時には，ラジアンおよび度の値を更新する
  //     if (fc_d_from_fc_vector[1] < 0) {
  //       rad_head_direction = -rad_head_direction;
  //       theta_head_direction = 360 - theta_head_direction;
  //     }

  //     // 自分自身のビデオウィンドウの情報を更新
  //     setMyWindowAndAudioAndParticipantsInfo(() =>
  //       updateWindowInfo(
  //         conditionID,
  //         fc_d_from_fc_vector,
  //         rad_head_direction,
  //         theta_head_direction,
  //         borderAlphaValueBasedVoice,
  //         isSpeaking,
  //         isSpeaking ? transcript : ''
  //       )
  //     );
  //   }
  // }, []); // MediaPipeによる顔検出 & 頭部方向の計算

  // const main = async () => {
  //   const dataStream = await SkyWayStreamFactory.createDataStream();
  //   setLocalDataStream(dataStream);
  //   await me?.publish(dataStream);
  // };

  // --- Effects ---
  // useEffect(() => {
  //   if (isMe) main();
  // }, []);
  useEffect(() => {
    if (videoRef?.current && subscription.stream) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      videoRef.current!.srcObject = new MediaStream([
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        subscription.stream!.track,
      ]);
    }
  }, [videoRef?.current, subscription.stream]);
  // // 自分の頭部方向を計算した後に，定期的にデータを送信するuseEffect
  // useEffect(() => {
  //   // eslint-disable-next-line
  //   console.log("localDataStream: " + localDataStream);
  //   if (localDataStream) {
  //     // eslint-disable-next-line
  //     console.log('Sending Data:', myWindowAndAudioAndParticipantsInfo); // デバッグ用
  //     localDataStream.write(myWindowAndAudioAndParticipantsInfo);
  //   }
  // }, [localDataStream, myWindowAndAudioAndParticipantsInfo]);
  // useEffect(() => {
  //   // eslint-disable-next-line
  //   console.log("MediaPipe Setup Before"); // デバッグ用
  //   // eslint-disable-next-line
  //   console.log("isMe: " + isMe); // デバッグ用
  //   // 自分自身のビデオに対してのみ行う（カメラの重複利用を避けるため）
  //   if (isMe) {
  //     // eslint-disable-next-line
  //     console.log("MediaPipe Setup Started"); // デバッグ用

  //     // MediaPipe側の初期設定
  //     const faceMesh = new FaceMesh({
  //       locateFile: (file) => {
  //         return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
  //       },
  //     });
  //     faceMesh.setOptions({
  //       maxNumFaces: 1,
  //       refineLandmarks: true, // landmarks 468 -> 478
  //       minDetectionConfidence: 0.5,
  //       minTrackingConfidence: 0.5,
  //     });
  //     faceMesh.onResults(onResults);

  //     // MediaPipeの顔検出用のカメラ検出
  //     if (videoRef.current) {
  //       const camera = new Camera(videoRef.current, {
  //         onFrame: async () => {
  //           // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  //           await faceMesh.send({ image: videoRef.current! });
  //         },
  //       });
  //       camera.start();
  //     }

  //     return () => {
  //       faceMesh.close();
  //     };
  //   }
  // }, [onResults]); // MediaPipeの顔検出の準備

  // --- Memos ---
  const style: CSSProperties = useMemo(() => {
    // // 自分自身のビデオの場合には，計算したデータを利用
    // if (isMe) {
    //   return {
    //     position: 'absolute',
    //     width: myWindowAndAudioAndParticipantsInfo.width,
    //     height: myWindowAndAudioAndParticipantsInfo.height,
    //     top: `calc(50% - ${
    //       myWindowAndAudioAndParticipantsInfo.height / 2
    //     }px + ${myWindowAndAudioAndParticipantsInfo.topDiff}px) + ${
    //       500 * +subscription.publication.publisher.id
    //     }px`,
    //     left: `calc(50% - ${
    //       myWindowAndAudioAndParticipantsInfo.width / 2
    //     }px + ${myWindowAndAudioAndParticipantsInfo.leftDiff}px)`,
    //     border: `10px solid rgba(${myWindowAndAudioAndParticipantsInfo.borderRed}, ${myWindowAndAudioAndParticipantsInfo.borderGreen}, ${myWindowAndAudioAndParticipantsInfo.borderBlue}, ${myWindowAndAudioAndParticipantsInfo.borderAlpha})`,
    //   };
    // }
    // // 自分自身以外のビデオの場合には，受け取ったデータを利用
    // else {
    console.log('Window Info:' + windowInfo);
    // WindowInfoが存在しない場合には，デフォルトスタイルを適用
    if (!windowInfo) {
      return {};
    }

    // windowInfoから動的にスタイル生成
    return {
      position: 'absolute',
      width: windowInfo?.width,
      top: `calc(50% - ${windowInfo?.height / 2}px + ${
        windowInfo?.topDiff
      }px) + ${windowInfo.width * participantNum}px`,
      left: `calc(50% - ${windowInfo?.width / 2}px + ${
        windowInfo?.leftDiff
      }px) + ${windowInfo.width * participantNum}px`,
      border: `10px solid rgba(${windowInfo?.borderRed}, ${windowInfo?.borderGreen}, ${windowInfo?.borderBlue}, ${windowInfo.borderAlpha})`,
    };
    // }
  }, [windowInfo]);

  const switchEncodingSetting = async () => {
    if (subscription.preferredEncoding === 'high') {
      subscription.changePreferredEncoding('low');
    } else if (subscription.preferredEncoding === 'low') {
      subscription.changePreferredEncoding('high');
    }
  };

  return (
    <div>
      <video
        muted
        autoPlay
        playsInline
        ref={videoRef}
        onClick={switchEncodingSetting}
        style={style}
      />
    </div>
  );
};
