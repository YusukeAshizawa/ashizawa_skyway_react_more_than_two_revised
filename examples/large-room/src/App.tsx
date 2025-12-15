// --- Import Statements ---
import './App.css';

import { Camera } from '@mediapipe/camera_utils';
// import { FaceMesh, Results } from '@mediapipe/face_mesh';
import * as mpFaceMesh from '@mediapipe/face_mesh';
import {
  FaceLandmarker,
  FaceLandmarkerResult,
  FilesetResolver,
} from '@mediapipe/tasks-vision';
import {
  LocalAudioStream,
  LocalDataStream,
  // LocalDataStream,
  LocalP2PRoomMember,
  // LocalStream,
  LocalVideoStream,
  nowInSec,
  RemoteDataStream,
  RemoteVideoStream,
  RoomPublication,
  RoomSubscription,
  SkyWayAuthToken,
  SkyWayContext,
  SkyWayError,
  SkyWayRoom,
  SkyWayStreamFactory,
  uuidV4,
} from '@skyway-sdk/room';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CSVLink } from 'react-csv';
import SpeechRecognition, {
  useSpeechRecognition,
} from 'react-speech-recognition';
import Webcam from 'react-webcam';

// import Webcam from 'react-webcam';
import { contextOptions, sfuOptions, tokenString } from './const';
import { Video } from './Video'; // 修正されたVideoコンポーネント

// --- Constant Valuale ---
const AppConstants = {
  MOVING_AVERAGE_FRAME: 10, // 移動平均計算時のフレーム数
  WIDTH_MAX: window.innerWidth, // ビデオウィンドウの大きさの最大値
  WIDTH_MIN: window.innerWidth * 0.8, // ビデオウィンドウの大きさの最小値
  HEIGHT_MAX: window.innerHeight, // ビデオウィンドウの大きさの最大値
  HEIGHT_MIN: window.innerHeight * 0.8, // ビデオウィンドウの大きさの最小値
  DISTANCE_RATE_MOVE: 10000, // 位置の移動を行う場合の，スクリーンの中心からのずれの拡大率
  DEFAULT_TOP_DIFF: 0, // 位置の移動を行う場合の，スクリーンの中心からの上下方向のずれ
  DEFAULT_LEFT_DIFF: 0, // 位置の移動を行う場合の，スクリーンの中心からの左右方向のずれ
  BORDER_ALPHA_MIN: 0, // ビデオウィンドウの枠の色の透明度の最小値
  BORDER_ALPHA_MAX: 1, // ビデオウィンドウの枠の色の透明度の最大値
  BORDER_ALPHA_MIN_THRESHOLD: 0.015, // ビデオウィンドウの枠の色を完全に透明にする時の閾値
  // DEFAULT_MY_WINDOW_WIDTH: 250, // 自分自身のビデオウィンドウの大きさのデフォルト値
  VOLUME_THRESHOLD: 10, // 発話と判定するボリュームの閾値（0-255，要調整）
  SPEAKING_DEBOUNCE_MS: 200, // 発話開始/終了の判定を安定させるためのデバウンス時間
  BORDER_COLORS: {
    GREEN: { r: 83, g: 253, b: 49, a: 0 }, // ビデオウィンドウの枠の色（緑色）
    BLACK: { r: 0, g: 0, b: 0, a: 0 }, // ビデオウィンドウの枠の色（黒色）
    RED: { r: 255, g: 0, b: 0, a: 0 }, // ビデオウィンドウの枠の色（赤色）
  },
};
const defaultWidth = (AppConstants.WIDTH_MAX + AppConstants.WIDTH_MIN) / 2; // ビデオウィンドウの幅のデフォルト値（参加者・対話相手共通）
const defaultHeight = (AppConstants.HEIGHT_MAX + AppConstants.HEIGHT_MIN) / 2; // ビデオウィンドウの高さのデフォルト値（参加者・対話相手共通）
const defaultBorderColor = AppConstants.BORDER_COLORS.GREEN; // ビデオウィンドウの枠の色のデフォルト値（参加者・対話相手共通）
const scrollMyX = window.scrollX; // 自分自身（参加者側）のスクロール位置（X座標）

// --- Interfaces ---
interface WindowAndAudioAndParticipantsInfo {
  ID: number;
  topDiff: number; // 位置を移動させる場合の上下方向の変化量
  leftDiff: number; // 位置を移動させる場合の左右方向の変化量
  width: number;
  height: number; // heightはwidthのHeightPerWidthRate倍
  borderRed: number; // ビデオウィンドウの枠の色（赤）の値
  borderGreen: number; // ビデオウィンドウの枠の色（緑）の値
  borderBlue: number; // ビデオウィンドウの枠の色（青）の値
  borderAlpha: number; // ビデオウィンドウの枠の色の透明度の値
  borderAlphaValueBasedVoice: number; // 発話タイミングに基づく，枠の色の透明度変化を表す値（自分自身用）
  theta: number; // 頭部方向（度）
  widthInCaseOfChange: number; // ビデオウィンドウの幅を変更した場合の幅
  heightInCaseOfChange: number; // ビデオウィンドウの大きさを変更した場合の大きさ
  isSpeaking: boolean; // 発言者か否か
  transcript: string; // 発言内容
  gazeStatus: string; // 参加者の状態（注視状態 or 視線回避状態 or ノーマル）
} // ビデオウィンドウの情報
interface CSV_HeadDirection_Info {
  ID: number;
  condition: number;
  startTime: number;
  endTime: number;
  theta: number;
  direction: string;
  windowWidth: number;
  windowHeight: number;
  statusGaze: string;
  // isSpeaking: boolean;
  // transcript: string;
} // CSVファイルに書き出す頭部方向の情報

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
let participantID = 1; // 参加者ID
let conditionID = 1; // 条件番号・条件名
let conditionName = 'Baseline'; // 条件名
let startTime = 0; // 計測開始時間
let videoSubscriptionsLength = 0;
const moveWidths: number[] = []; // ビデオウィンドウの幅の移動平均を計算するためのリスト
const moveHeights: number[] = []; // ビデオウィンドウの高さの移動平均を計算するためのリスト
const moveBorderAlphas: number[] = []; // ビデオウィンドウの枠の色の透明度の移動平均を計算するためのリスト
const isSpeaking = false; // 発話状態か否か
const borderAlphaValueBasedVoice = AppConstants.BORDER_ALPHA_MIN; // 発話タイミングに基づく，枠の色の透明度変化を表す値
const gap_between_participants = 20; // 各参加者のビデオウィンドウ間の感覚

// --- Component Logic ---
const App: FC = () => {
  // --- States ---
  const [roomName, setRoomName] = useState(''); // ルーム名
  const [me, setMe] = useState<LocalP2PRoomMember>(); // 自分自身の参加者情報
  const [localStream, setLocalStream] = useState<{
    audio: LocalAudioStream;
    video: LocalVideoStream;
  }>();
  const [localDataStream, setLocalDataStream] = useState<LocalDataStream>();
  const [videoSubscriptions, setVideoSubscriptions] = useState<
    RoomSubscription<RemoteVideoStream>[]
  >([]);
  // const [videoSubscriptionsLength, setVideoSubscriptionsLength] =
  //   useState<number>(0);
  const [
    myWindowAndAudioAndParticipantsInfo,
    setMyWindowAndAudioAndParticipantsInfo,
  ] = useState<WindowAndAudioAndParticipantsInfo>({
    ID: -1,
    topDiff: AppConstants.DEFAULT_TOP_DIFF,
    leftDiff: AppConstants.DEFAULT_LEFT_DIFF,
    width: 300,
    height: 300,
    borderRed: defaultBorderColor.r,
    borderGreen: defaultBorderColor.g,
    borderBlue: defaultBorderColor.b,
    borderAlpha: defaultBorderColor.a,
    borderAlphaValueBasedVoice: borderAlphaValueBasedVoice,
    widthInCaseOfChange: 0,
    heightInCaseOfChange: 0,
    theta: 0,
    isSpeaking: false,
    transcript: '',
    gazeStatus: '',
  }); // 自分自身のウィンドウの情報
  const [remoteParticipantsInfo, setRemoteParticipantsInfo] = useState<
    Map<string, WindowAndAudioAndParticipantsInfo>
  >(new Map());
  const [remoteDataStreams, setRemoteDataStreams] = useState<
    Map<string, RemoteDataStream>
  >(new Map());
  const { transcript, resetTranscript, browserSupportsSpeechRecognition } =
    useSpeechRecognition(); // 音声認識設定
  const [headDirectionResults, setHeadDirectionResults] = useState<
    CSV_HeadDirection_Info[]
  >([]);
  const [startTime_HeadDirection, setStartTime_HeadDirection] =
    useState<number>(0); // ウィンドウ情報収集開始時間
  const [nowTest, setNowTest] = useState<boolean>(false); // ウィンドウ情報収集中か否か
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  // --- Refs ---
  const localVideoRef = useRef<HTMLVideoElement>(null);
  // const audioContextRef = useRef<AudioContext | null>(null);
  // const analyserNodeRef = useRef<AnalyserNode | null>(null);
  // const dataArrayRef = useRef<Uint8Array | null>(null);
  // const audtioInputGainNodeRef = useRef<GainNode | null>(null); // オプション: マイク入力のゲイン調整用
  const webcamRef = useRef<Webcam>(null); // Webcamの参照
  const audioContainer = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<mpFaceMesh.Results>(); // MediaPipeの検出結果を格納するための参照
  const CSV_Ref = useRef<
    CSVLink & HTMLAnchorElement & { link: HTMLAnchorElement }
  >(null); // CSVファイルのリンクを格納するための参照

  // --- Memos ---
  const myWindowAndAudioContainerStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'absolute',
      // top: 50, // 文字入力欄に被らないように調整（レイアウト変更前）
      // left: 0, // 右上の場合：0（右下の場合：window.innerWidth - AppConstants.DEFAULT_MY_WINDOW_WIDTH - 20）（レイアウト変更前）
      top: `${
        // レイアウト変更後
        0 +
        // window.screen.height / 2 - // ウィンドウを中央揃えにする
        // ↓：Zoom のギャラリービュー風レイアウト（participantNumは1から，participantNumの1番には自分自身の映るカメラが対応している）
        AppConstants.HEIGHT_MAX /
          (1 + Math.floor(videoSubscriptionsLength / 2)) /
          2 -
        myWindowAndAudioAndParticipantsInfo.height / 2 +
        myWindowAndAudioAndParticipantsInfo.topDiff
      }px`,
      left: `${
        // レイアウト変更後
        window.screenLeft +
        scrollMyX +
        // window.screen.width / 2 - // ウィンドウを中央揃えにする
        // ↓：Zoom のギャラリービュー風レイアウト（participantNumは1から，participantNumの1番には自分自身の映るカメラが対応している）
        (videoSubscriptions.length === 0
          ? AppConstants.WIDTH_MAX / 2
          : AppConstants.WIDTH_MAX / 4) -
        myWindowAndAudioAndParticipantsInfo.width / 2 +
        myWindowAndAudioAndParticipantsInfo.leftDiff +
        0
        // (windowMax + 50) * ((participantNum - 2) + 1 - ((participantAllNums- 1) + 1) / 2) // ウィンドウを中央揃えにする
      }px`,
      width:
        myWindowAndAudioAndParticipantsInfo.width - gap_between_participants,
      height:
        myWindowAndAudioAndParticipantsInfo.height - gap_between_participants,
      border: `10px solid rgba(${myWindowAndAudioAndParticipantsInfo.borderRed}, ${myWindowAndAudioAndParticipantsInfo.borderGreen}, ${myWindowAndAudioAndParticipantsInfo.borderBlue}, ${myWindowAndAudioAndParticipantsInfo.borderAlpha})`,
    }),
    [myWindowAndAudioAndParticipantsInfo]
  ); // 参加者側のビデオウィンドウのスタイル

  // --- Callbacks ---
  // ビデオウィンドウのInfoの更新+音声データの追加
  const updateWindowInfo = useCallback(
    (
      conditionID: number,
      fc_d_from_fc_vector: number[],
      rad_head_direction: number,
      theta_head_direction: number,
      borderAlphaValueBasedVoice: number,
      status: boolean,
      text: string,
      videoSubscriptionsLength: number
    ): WindowAndAudioAndParticipantsInfo => {
      //  --- Variables ---
      let next_width_rate = 0; // ウィンドウの大きさの最大値に対する，実際のウィンドウの大きさの比率
      let next_border_a_rate = 0; // ビデオウィンドウの枠の色の透明度の比率
      let width_value = 0; // ビデオウィンドウの大きさ
      let height_value = 0; // ビデオウィンドウの大きさ
      let border_a_value = 0; // ビデオウィンドウの枠の色の透明度
      let myWindowWidthTmpValue = 0; // ビデオウィンドウの幅（保存・分析用）
      let myWindowHeightTmpValue = 0; // ビデオウィンドウの幅（保存・分析用）
      let width_value_discrete = 0; // 離散変化時のビデオウィンドウの幅
      let height_value_discrete = 0; // 離散変化時のビデオウィンドウの幅
      let gazeStatus = ''; // 参加者の視線状態（注視状態 or 視線回避状態）
      const top_diff_value =
        AppConstants.DISTANCE_RATE_MOVE *
        Utils.norm(fc_d_from_fc_vector) *
        Math.sin(rad_head_direction); // スクリーンの中心からの上下方向のずれ
      const left_diff_value =
        AppConstants.DISTANCE_RATE_MOVE *
        Utils.norm(fc_d_from_fc_vector) *
        Math.cos(rad_head_direction - Math.PI); // スクリーンの中心からの左右方向のずれ
      let newInfo: WindowAndAudioAndParticipantsInfo; // ビデオウィンドウの情報をまとめたデータ
      const tmp_WIDTH_MAX =
        videoSubscriptionsLength === 0
          ? AppConstants.WIDTH_MAX
          : AppConstants.WIDTH_MAX / 2;
      const tmp_WIDTH_MIN =
        videoSubscriptionsLength === 0
          ? AppConstants.WIDTH_MIN
          : AppConstants.WIDTH_MIN / 2;
      const tmp_defaultWidth =
        videoSubscriptionsLength === 0 ? defaultWidth : defaultWidth / 2;
      const tmp_HEIGHT_MAX =
        AppConstants.HEIGHT_MAX /
        (1 + Math.floor(videoSubscriptionsLength / 2));
      const tmp_HEIGHT_MIN =
        AppConstants.HEIGHT_MIN /
        (1 + Math.floor(videoSubscriptionsLength / 2));
      const tmp_defaultHeight =
        defaultHeight / (1 + Math.floor(videoSubscriptionsLength / 2));

      // eslint-disable-next-line
      console.log("videoSubscriptionsLength = " + videoSubscriptionsLength);

      // ウィンドウの大きさ・ビデオウィンドウの枠の色の透明度の計算
      if (150 * Utils.norm(fc_d_from_fc_vector) <= 1) {
        next_width_rate = 1;
        next_border_a_rate = 1;
      } else {
        next_width_rate = 1 / (150 * Utils.norm(fc_d_from_fc_vector));
        next_border_a_rate = 1 / (150 * Utils.norm(fc_d_from_fc_vector));
      }
      // width_value = AppConstants.WIDTH_MAX * next_width_rate; // レイアウト変更前
      width_value = tmp_WIDTH_MAX * next_width_rate; // レイアウト変更後
      height_value = tmp_HEIGHT_MAX * next_width_rate; // レイアウト変更後
      border_a_value = AppConstants.BORDER_ALPHA_MAX * next_border_a_rate;

      // ウィンドウの大きさ・ビデオウィンドウの枠の色の透明度が最小値を下回らないようにする
      // // レイアウト変更前
      // if (width_value < AppConstants.WIDTH_MIN)
      //   width_value = AppConstants.WIDTH_MIN;
      // レイアウト変更後
      if (width_value < tmp_WIDTH_MIN) {
        width_value = tmp_WIDTH_MIN;
      }
      if (height_value < tmp_HEIGHT_MIN) {
        height_value = tmp_HEIGHT_MIN;
      }
      if (border_a_value < AppConstants.BORDER_ALPHA_MIN_THRESHOLD)
        border_a_value = AppConstants.BORDER_ALPHA_MIN;

      myWindowWidthTmpValue = width_value; // ウィンドウ幅の一時保存（大きさを変更しない条件でも分析できるようにするため）
      myWindowHeightTmpValue = height_value; // ウィンドウサイズの一時保存（大きさを変更しない条件でも分析できるようにするため）

      // 移動平均の計算 + リストの肥大化の防止（ビデオウィンドウの大きさ・ビデオウィンドウの枠の色の透明度）
      moveWidths.push(width_value);
      moveHeights.push(height_value);
      moveBorderAlphas.push(border_a_value);
      if (moveWidths.length < AppConstants.MOVING_AVERAGE_FRAME)
        width_value = Utils.averageValue(moveWidths, 0, moveWidths.length - 1);
      else {
        if (moveWidths.length > AppConstants.MOVING_AVERAGE_FRAME + 3)
          moveWidths.shift();
        width_value = Utils.averageValue(
          moveWidths,
          moveWidths.length - AppConstants.MOVING_AVERAGE_FRAME,
          moveWidths.length - 1
        );
      }
      if (moveHeights.length < AppConstants.MOVING_AVERAGE_FRAME)
        height_value = Utils.averageValue(
          moveHeights,
          0,
          moveHeights.length - 1
        );
      else {
        if (moveHeights.length > AppConstants.MOVING_AVERAGE_FRAME + 3)
          moveHeights.shift();
        height_value = Utils.averageValue(
          moveHeights,
          moveHeights.length - AppConstants.MOVING_AVERAGE_FRAME,
          moveHeights.length - 1
        );
      }
      if (moveBorderAlphas.length < AppConstants.MOVING_AVERAGE_FRAME)
        border_a_value = Utils.averageValue(
          moveBorderAlphas,
          0,
          moveBorderAlphas.length - 1
        );
      else {
        if (moveBorderAlphas.length > AppConstants.MOVING_AVERAGE_FRAME + 3)
          moveBorderAlphas.shift();
        border_a_value = Utils.averageValue(
          moveBorderAlphas,
          moveBorderAlphas.length - AppConstants.MOVING_AVERAGE_FRAME,
          moveBorderAlphas.length - 1
        );
      }

      // 離散変化時のビデオウィンドウの大きさの計算
      // // レイアウト変更前
      // if (
      //   width_value >
      //   AppConstants.WIDTH_MAX -
      //     (AppConstants.WIDTH_MAX - AppConstants.WIDTH_MIN) * 0.1
      // ) {
      //   width_value_discrete = AppConstants.WIDTH_MAX; // 最大サイズ
      // } else width_value_discrete = AppConstants.WIDTH_MIN; // 最小サイズ
      // レイアウト変更後
      if (width_value > tmp_WIDTH_MAX - (tmp_WIDTH_MAX - tmp_WIDTH_MIN) * 0.1) {
        width_value_discrete = tmp_WIDTH_MAX; // 最大幅
      } else width_value_discrete = tmp_WIDTH_MIN; // 最小幅
      if (
        height_value >
        tmp_HEIGHT_MAX - (tmp_HEIGHT_MAX - tmp_HEIGHT_MIN) * 0.1
      ) {
        height_value_discrete = tmp_HEIGHT_MAX; // 最大サイズ
      } else height_value_discrete = tmp_HEIGHT_MIN; // 最小サイズ

      // 参加者の視線状態（注視状態 or 視線回避状態）の算出
      // // レイアウト変更前
      // if (
      //   myWindowWidthTmpValue >
      //   AppConstants.WIDTH_MAX -
      //     (AppConstants.WIDTH_MAX - AppConstants.WIDTH_MIN) * 0.1
      // ) {
      //   gazeStatus = 'mutual gaze';
      // } // ビデオウィンドウの大きさが最大値の10%以内の時には，注視状態であると判断する
      // if (
      //   myWindowWidthTmpValue <
      //   AppConstants.WIDTH_MIN +
      //     (AppConstants.WIDTH_MAX - AppConstants.WIDTH_MIN) * 0.1
      // ) {
      //   gazeStatus = 'gaze aversion';
      // } // ビデオウィンドウの大きさが最小値の10%以内の時には，視線回避状態であると判断する
      // レイアウト変更後
      if (
        myWindowWidthTmpValue >
        tmp_WIDTH_MAX - (tmp_WIDTH_MAX - tmp_WIDTH_MIN) * 0.1
      ) {
        gazeStatus = 'mutual gaze';
      } // ビデオウィンドウの大きさが最大値の10%以内の時には，注視状態であると判断する
      if (
        myWindowWidthTmpValue <
        tmp_WIDTH_MIN + (tmp_WIDTH_MAX - tmp_WIDTH_MIN) * 0.1
      ) {
        gazeStatus = 'gaze aversion';
      } // ビデオウィンドウの大きさが最小値の10%以内の時には，視線回避状態であると判断する

      // ビデオウィンドウの情報をまとめたデータの作成
      const baseInfo = {
        ID: participantID,
        borderRed: defaultBorderColor.r,
        borderGreen: defaultBorderColor.g,
        borderBlue: defaultBorderColor.b,
        borderAlphaValueBasedVoice: borderAlphaValueBasedVoice,
        widthInCaseOfChange: myWindowWidthTmpValue,
        heightInCaseOfChange: myWindowHeightTmpValue,
        theta: theta_head_direction,
        isSpeaking: status,
        transcript: text,
        gazeStatus: gazeStatus,
      }; // ビデオウィンドウの情報のベースデータ

      switch (conditionID) {
        case 1: // Baseline条件
          newInfo = {
            ...baseInfo,
            topDiff: AppConstants.DEFAULT_TOP_DIFF,
            leftDiff: AppConstants.DEFAULT_LEFT_DIFF,
            // // レイアウト変更前
            // width: defaultWidth,
            // height: defaultWidth,
            // レイアウト変更後
            width: tmp_defaultWidth,
            height: tmp_defaultHeight,
            borderAlpha: borderAlphaValueBasedVoice,
          };
          break;
        case 2: // FrameChange条件
          newInfo = {
            ...baseInfo,
            topDiff: AppConstants.DEFAULT_TOP_DIFF,
            leftDiff: AppConstants.DEFAULT_LEFT_DIFF,
            // // レイアウト変更前
            // width: defaultWidth,
            // height: defaultWidth,
            // レイアウト変更後
            width: tmp_defaultWidth,
            height: tmp_defaultHeight,
            borderAlpha: border_a_value,
          };
          break;
        case 3: // SizeChange条件
          newInfo = {
            ...baseInfo,
            topDiff: AppConstants.DEFAULT_TOP_DIFF,
            leftDiff: AppConstants.DEFAULT_LEFT_DIFF,
            width: width_value,
            height: height_value,
            borderAlpha: borderAlphaValueBasedVoice,
          };
          break;
        case 4: // SizeChange_Discrete条件
          newInfo = {
            ...baseInfo,
            topDiff: AppConstants.DEFAULT_TOP_DIFF,
            leftDiff: AppConstants.DEFAULT_LEFT_DIFF,
            width: width_value_discrete,
            height: height_value_discrete,
            borderAlpha: borderAlphaValueBasedVoice,
          };
          break;
        case 5: // PositionChange条件
          newInfo = {
            ...baseInfo,
            topDiff: top_diff_value,
            leftDiff: left_diff_value,
            // // レイアウト変更前
            // width: defaultWidth,
            // height: defaultWidth,
            // レイアウト変更後
            width: tmp_defaultWidth,
            height: tmp_defaultHeight,
            borderAlpha: borderAlphaValueBasedVoice,
          };
          break;
        case 6: // PositionAndSizeChange条件
          newInfo = {
            ...baseInfo,
            topDiff: top_diff_value,
            leftDiff: left_diff_value,
            width: width_value,
            height: height_value,
            borderAlpha: borderAlphaValueBasedVoice,
          };
          break;
        default: // Baseline条件
          newInfo = {
            ...baseInfo,
            topDiff: AppConstants.DEFAULT_TOP_DIFF,
            leftDiff: AppConstants.DEFAULT_LEFT_DIFF,
            // // レイアウト変更前
            // width: defaultWidth,
            // height: defaultWidth,
            // レイアウト変更後
            width: tmp_defaultWidth,
            height: tmp_defaultHeight,
            borderAlpha: borderAlphaValueBasedVoice,
          };
      }

      return newInfo; // ビデオウィンドウの情報を返す
    },
    []
  );
  const onResults = useCallback((results: mpFaceMesh.Results) => {
    // 顔の座標が正しく取得できている時のみ実行
    if (results.multiFaceLandmarks.length > 0) {
      // 検出結果の格納
      resultsRef.current = results;

      // 頭部方向の取得
      const landmarks_pos_x: number[] = []; // 468個の点のx座標を格納するリスト
      const landmarks_pos_y: number[] = []; // 468個の点のy座標を格納するリスト
      const face_center_default_pos: number[] = []; // 正面を向いた時の顔の中心点（ここでは，飯塚さんの修論に倣って，鼻の先の座標としている．）
      if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
        for (let id = 0; id < results.multiFaceLandmarks[0].length; id++) {
          // 特定の顔の点を取得（x座標）
          if (results.multiFaceLandmarks[0][id].x < 0) landmarks_pos_x.push(0);
          else if (results.multiFaceLandmarks[0][id].x > 1)
            landmarks_pos_x.push(1);
          else landmarks_pos_x.push(results.multiFaceLandmarks[0][id].x);

          // 特定の顔の点を取得（y座標）
          if (results.multiFaceLandmarks[0][id].y < 0) landmarks_pos_y.push(0);
          else if (results.multiFaceLandmarks[0][id].y > 1)
            landmarks_pos_y.push(1);
          else landmarks_pos_y.push(results.multiFaceLandmarks[0][id].y);

          // 正面を向いた時の顔の中心点を取得（x，y座標）
          if (id === 1) {
            // x座標
            if (results.multiFaceLandmarks[0][id].x < 0)
              face_center_default_pos.push(0);
            else if (results.multiFaceLandmarks[0][id].x > 1)
              face_center_default_pos.push(1);
            else
              face_center_default_pos.push(results.multiFaceLandmarks[0][id].x);

            // y座標
            if (results.multiFaceLandmarks[0][id].y < 0)
              face_center_default_pos.push(0);
            else if (results.multiFaceLandmarks[0][id].y > 1)
              face_center_default_pos.push(1);
            else
              face_center_default_pos.push(results.multiFaceLandmarks[0][id].y);
          }
        }
      }
      // 顔の中心点の座標
      const face_center_pos = [
        Utils.averageValue(landmarks_pos_x),
        Utils.averageValue(landmarks_pos_y),
      ];
      const base_vector = [1, 0]; // 頭部方向を計算するためのベクトル
      const fc_d_from_fc_vector = [
        face_center_default_pos[0] - face_center_pos[0],
        face_center_default_pos[1] - face_center_pos[1],
      ]; // 顔の中心点を原点とした時の，正面を向いた際の顔の中心点のベクトル
      let rad_head_direction = Math.acos(
        Utils.inner(base_vector, fc_d_from_fc_vector) /
          (Utils.norm(base_vector) * Utils.norm(fc_d_from_fc_vector))
      ); // 頭部方向（ラジアン）
      let theta_head_direction = rad_head_direction * (180 / Math.PI); // 頭部方向（度）
      // arccosの値域が0～πであるため，上下の区別をするために，上を向いている時には，ラジアンおよび度の値を更新する
      if (fc_d_from_fc_vector[1] < 0) {
        rad_head_direction = -rad_head_direction;
        theta_head_direction = 360 - theta_head_direction;
      }

      // 自分自身のビデオウィンドウの情報を更新
      setMyWindowAndAudioAndParticipantsInfo(() =>
        updateWindowInfo(
          conditionID,
          fc_d_from_fc_vector,
          rad_head_direction,
          theta_head_direction,
          borderAlphaValueBasedVoice,
          isSpeaking,
          isSpeaking ? transcript : '',
          videoSubscriptionsLength
        )
      );
    }
  }, []); // MediaPipeによる顔検出 & 頭部方向の計算
  const onResults_new = useCallback((results: FaceLandmarkerResult) => {
    // 顔の座標が正しく取得できている時のみ実行
    if (results.faceLandmarks.length > 0) {
      // // 検出結果の格納
      // resultsRef_new.current = results;

      // 頭部方向の取得
      const landmarks_pos_x: number[] = []; // 468個の点のx座標を格納するリスト
      const landmarks_pos_y: number[] = []; // 468個の点のy座標を格納するリスト
      const face_center_default_pos: number[] = []; // 正面を向いた時の顔の中心点（ここでは，飯塚さんの修論に倣って，鼻の先の座標としている．）
      if (results.faceLandmarks && results.faceLandmarks[0]) {
        for (let id = 0; id < results.faceLandmarks[0].length; id++) {
          // 特定の顔の点を取得（x座標）
          if (results.faceLandmarks[0][id].x < 0) landmarks_pos_x.push(0);
          else if (results.faceLandmarks[0][id].x > 1) landmarks_pos_x.push(1);
          else landmarks_pos_x.push(results.faceLandmarks[0][id].x);

          // 特定の顔の点を取得（y座標）
          if (results.faceLandmarks[0][id].y < 0) landmarks_pos_y.push(0);
          else if (results.faceLandmarks[0][id].y > 1) landmarks_pos_y.push(1);
          else landmarks_pos_y.push(results.faceLandmarks[0][id].y);

          // 正面を向いた時の顔の中心点を取得（x，y座標）
          if (id === 1) {
            // x座標
            if (results.faceLandmarks[0][id].x < 0)
              face_center_default_pos.push(0);
            else if (results.faceLandmarks[0][id].x > 1)
              face_center_default_pos.push(1);
            else face_center_default_pos.push(results.faceLandmarks[0][id].x);

            // y座標
            if (results.faceLandmarks[0][id].y < 0)
              face_center_default_pos.push(0);
            else if (results.faceLandmarks[0][id].y > 1)
              face_center_default_pos.push(1);
            else face_center_default_pos.push(results.faceLandmarks[0][id].y);
          }
        }
      }
      // 顔の中心点の座標
      const face_center_pos = [
        Utils.averageValue(landmarks_pos_x),
        Utils.averageValue(landmarks_pos_y),
      ];
      const base_vector = [1, 0]; // 頭部方向を計算するためのベクトル
      const fc_d_from_fc_vector = [
        face_center_default_pos[0] - face_center_pos[0],
        face_center_default_pos[1] - face_center_pos[1],
      ]; // 顔の中心点を原点とした時の，正面を向いた際の顔の中心点のベクトル
      let rad_head_direction = Math.acos(
        Utils.inner(base_vector, fc_d_from_fc_vector) /
          (Utils.norm(base_vector) * Utils.norm(fc_d_from_fc_vector))
      ); // 頭部方向（ラジアン）
      let theta_head_direction = rad_head_direction * (180 / Math.PI); // 頭部方向（度）
      // arccosの値域が0～πであるため，上下の区別をするために，上を向いている時には，ラジアンおよび度の値を更新する
      if (fc_d_from_fc_vector[1] < 0) {
        rad_head_direction = -rad_head_direction;
        theta_head_direction = 360 - theta_head_direction;
      }

      // 自分自身のビデオウィンドウの情報を更新
      setMyWindowAndAudioAndParticipantsInfo(() =>
        updateWindowInfo(
          conditionID,
          fc_d_from_fc_vector,
          rad_head_direction,
          theta_head_direction,
          borderAlphaValueBasedVoice,
          isSpeaking,
          isSpeaking ? transcript : '',
          videoSubscriptionsLength
        )
      );
    }
  }, []); // MediaPipe（new version）による顔検出 & 頭部方向の計算
  const testStart = useCallback(() => {
    // 頭部方向の書き出し開始
    setHeadDirectionResults([
      {
        ID: -1,
        condition: conditionID,
        startTime: 0,
        endTime: 0,
        theta: 0,
        direction: '',
        windowWidth: 0,
        windowHeight: 0,
        statusGaze: '',
      },
    ]);
    setStartTime_HeadDirection(0);
    startTime = performance.now();
    setNowTest(true);
  }, []); // CSVファイルへのウィンドウ情報書き出し開始
  const testEnd = useCallback(() => {
    setNowTest(false);
    CSV_Ref?.current?.link.click();
  }, []); // CSVファイルへのウィンドウ情報書き出し終了 & CSV保存

  const main = async () => {
    const context = await SkyWayContext.Create(tokenString, contextOptions);
    const room = await SkyWayRoom.FindOrCreate(context, {
      name: roomName,
      type: 'p2p', // sfuだと，dataStreamが使用不可
      options: sfuOptions,
    });
    const member = await room.join();
    setMe(member);

    // カメラの種類の選択
    navigator.mediaDevices
      .getUserMedia({
        video: { frameRate: 15 },
      })
      .then((stream) => {
        // eslint-disable-next-line
        console.log(stream);  // デバッグ用
      })
      .catch(console.error);
    const devices_tmp = (
      await navigator.mediaDevices.enumerateDevices()
    ).filter((device) => device.label.includes('USB Camera'));
    console.log(devices_tmp);
    setDevices(devices_tmp);

    // ストリームの生成と公開
    const stream =
      await SkyWayStreamFactory.createMicrophoneAudioAndCameraStream({
        video: { frameRate: 15 },
      });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream.video.attach(localVideoRef.current!);
    const dataStream = await SkyWayStreamFactory.createDataStream();
    setLocalStream(stream);
    setLocalDataStream(dataStream);
    await localVideoRef.current?.play();

    // SFUに合わせた公開
    await member.publish(stream.audio, { maxSubscribers: 50 });
    await member.publish(stream.video, {
      maxSubscribers: 50,
      encodings: [
        { scaleResolutionDownBy: 4, id: 'low', maxBitrate: 80_000 },
        { scaleResolutionDownBy: 1, id: 'high', maxBitrate: 400_000 },
      ],
    });
    if (dataStream !== undefined) {
      // eslint-disable-next-line
      console.log("published data stream"); // デバッグ用
      await member.publish(dataStream);
    }

    // 他の参加者のストリームを購読
    member.onPublicationSubscribed.add((e) => {
      if (e.stream.contentType === 'audio') {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const container = audioContainer ? audioContainer.current! : null;
        const audio = document.createElement('audio');
        audio.srcObject = new MediaStream([e.stream.track]);
        audio.play();
        container?.appendChild(audio);
        e.subscription.onCanceled.once(() => {
          container?.removeChild(audio);
        });
      }
    });
    // ルームに参加した後にリスナーを設定
    member.onPublicationUnsubscribed.add((e) => {
      // 購読しようとしていたストリームがキャンセルされた場合，関連する状態（remoteDataStreams）をクリーンアップする
      setRemoteDataStreams((prev) => {
        const newMap = new Map(prev);
        newMap.delete(e.subscription.id);
        return newMap;
      });
    });

    // 映像ストリームの購読リストの更新
    member.onSubscriptionListChanged.add(() => {
      const subscriptions = member.subscriptions.filter(
        (subscription): subscription is RoomSubscription<RemoteVideoStream> =>
          subscription.contentType === 'video'
      );
      setVideoSubscriptions(subscriptions);
      console.log('subscriptions.length', subscriptions.length);
      videoSubscriptionsLength = subscriptions.length;
    });

    // // 外部のデータストリームを受信・処理
    // const subscribe = async (publication: RoomPublication) => {
    //   if (publication.publisher.id !== member.id) {
    //     if (publication.contentType === 'data') {
    //       const { stream } = await member.subscribe(publication);
    //       if (stream.contentType === 'data') {
    //         setRemoteDataStreams((prev) =>
    //           new Map(prev).set(publication.publisher.id, stream)
    //         );
    //       }
    //     }
    //     if (publication.contentType === 'video') {
    //       await member.subscribe(publication, {
    //         preferredEncodingId: 'low',
    //       });
    //     } else {
    //       await member.subscribe(publication);
    //     }
    //   }
    // };
    // SFUの場合
    // room.onStreamPublished.add(async (e) => {
    //   if (e.publication.publisher.id !== member.id) {
    //     await subscribe(e.publication);
    //   }
    // });
    // P2Pの場合，dataストリーム以外は自動購読されるため，dataストリームのみを購読する
    room.onStreamPublished.add(async (e) => {
      if (
        e.publication.publisher.id !== member.id
        // e.publication.publisher.id !== member.id &&
        // e.publication.contentType === 'data'
      ) {
        try {
          // Subscribeの前に，すでに購読済みでないかを確認するロジックを追加することも有効
          // ただし，このイベントは新規公開時のみ発火するため，新しいデータストリームを購読するだけであれば問題ない
          const { stream } = await member.subscribe(e.publication);
          if (stream.contentType === 'data') {
            setRemoteDataStreams((prev) =>
              new Map(prev).set(e.publication.publisher.id, stream)
            );
          }
        } catch (error) {
          console.log('Failed to subscribe to data stream:', error);
          // エラーメッセージから原因を特定し，無視するなどの対応が可能
          if (error instanceof SkyWayError && error.name === 'internal') {
            console.log(
              'Publisher already left the room, ignoring subscription.'
            );
          }
        }
      }
    });
    // 既に公開されているストリームを購読（SFUでは全てのストリームを手動で購読する必要がある）
    // await Promise.all(room.publications.map(subscribe));

    // 部屋名のみを表示させる
    document
      .getElementById('active-after-conference')
      ?.classList.remove('non-active');
    document
      .getElementById('active-before-conference')
      ?.classList.add('non-active');

    // 既に公開されているストリームを購読（P2Pの場合）
    await Promise.all(
      room.publications
        // // データストリームのみをフィルタリング
        // .filter((publication) => publication.contentType === 'data')
        // 自分の公開ストリームを除外する
        .filter((publication) => publication.publisher.id !== member.id)
        .map(async (publication) => {
          try {
            // データストリームのみ後続する
            const { stream } = await member.subscribe(publication);
            if (stream.contentType === 'data') {
              // 受信したデータストリームを処理
              setRemoteDataStreams((prev) =>
                new Map(prev).set(publication.publisher.id, stream)
              );
            }
          } catch (error) {
            console.error('Failed to subscribe:', error);
          }
        })
    );
  };

  // --- Effects ---
  // データストリームから情報を受信するuseEffect
  useEffect(() => {
    remoteDataStreams.forEach((stream, id) => {
      stream.onData.add((args) => {
        // eslint-disable-next-line
        console.log("Receiving Data from", id, ":", args);
        setRemoteParticipantsInfo((prev) => {
          const newMap = new Map(prev);
          newMap.set(id, args as WindowAndAudioAndParticipantsInfo);
          return newMap;
        });
      });
    });
  }, [remoteDataStreams]);
  // 自分の頭部方向を計算した後に，定期的にデータを送信するuseEffect
  useEffect(() => {
    if (localDataStream) {
      // eslint-disable-next-line
      console.log('Sending Data:', myWindowAndAudioAndParticipantsInfo); // デバッグ用
      localDataStream.write(myWindowAndAudioAndParticipantsInfo);
    }
  }, [localDataStream, myWindowAndAudioAndParticipantsInfo]);
  useEffect(() => {
    // let landmarker: FaceLandmarker | undefined;

    // // MediaPipe側の初期設定（tasks-vision利用）
    // const mediaPipeInit = async () => {
    //   // Wasm バンドルの読み込み
    //   const vision = await FilesetResolver.forVisionTasks(
    //     'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
    //   );

    //   // PoseLandmarker 初期化
    //   landmarker = await FaceLandmarker.createFromOptions(vision, {
    //     baseOptions: {
    //       modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
    //       delegate: 'GPU', // GPU 利用。CPU しかない環境でも自動フォールバック
    //     },
    //     outputFaceBlendshapes: true,
    //     runningMode: 'VIDEO',
    //   });

    //   // 推定ループ
    //   const mediaPipeDetect = () => {
    //     if (!localVideoRef.current || !webcamRef.current || !landmarker) return;

    //     const ts = performance.now();
    //     const res = landmarker.detectForVideo(webcamRef.current!.video!, ts);
    //     if (res.faceLandmarks.length) {
    //       onResults_new(res);
    //     }
    //     requestAnimationFrame(mediaPipeDetect);
    //   };
    //   mediaPipeDetect();
    // };

    // mediaPipeInit();

    // MediaPipe側の初期設定（FaceMeshコンストラクタ利用）
    const faceMesh = new mpFaceMesh.FaceMesh({
      // ここをCDNに完全固定
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      },
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true, // landmarks 468 -> 478
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    faceMesh.onResults(onResults);

    // MediaPipeの顔検出用のカメラ検出
    if (localVideoRef.current && webcamRef.current?.video) {
      const camera = new Camera(webcamRef.current!.video!, {
        onFrame: async () => {
          await faceMesh.send({ image: webcamRef.current!.video! });
        },
      });
      camera.start();
    }

    return () => {
      faceMesh.close();
      // landmarker?.close();
    };
  }, [onResults]); // MediaPipeの顔検出の準備
  useEffect(() => {
    if (localDataStream && remoteDataStreams) {
      if (nowTest) {
        // 自分自身のウィンドウ情報を追加
        const nowTime_HeadDirection = (performance.now() - startTime) / 1000;
        const currentmyEntry: CSV_HeadDirection_Info = {
          ID: participantID,
          condition: conditionID,
          startTime: startTime_HeadDirection,
          endTime: nowTime_HeadDirection,
          theta: myWindowAndAudioAndParticipantsInfo.theta,
          direction: Utils.getParticipantDirection(
            myWindowAndAudioAndParticipantsInfo.theta
          ),
          windowWidth: myWindowAndAudioAndParticipantsInfo.widthInCaseOfChange,
          windowHeight:
            myWindowAndAudioAndParticipantsInfo.heightInCaseOfChange,
          statusGaze: myWindowAndAudioAndParticipantsInfo.gazeStatus,
        };
        setHeadDirectionResults((prev) => [...prev, currentmyEntry]);

        videoSubscriptions.map((subscription) => {
          const remoteParticipantInfo:
            | WindowAndAudioAndParticipantsInfo
            | undefined = remoteParticipantsInfo.get(
            subscription.publication.publisher.id
          );
          const currentOtherEntry: CSV_HeadDirection_Info = {
            ID: remoteParticipantInfo ? remoteParticipantInfo.ID : -1,
            condition: conditionID,
            startTime: startTime_HeadDirection,
            endTime: nowTime_HeadDirection,
            theta: remoteParticipantInfo ? remoteParticipantInfo.theta : 0,
            direction: Utils.getParticipantDirection(
              remoteParticipantInfo ? remoteParticipantInfo.theta : 0
            ),
            windowWidth: remoteParticipantInfo
              ? remoteParticipantInfo.widthInCaseOfChange
              : 0,
            windowHeight: remoteParticipantInfo
              ? remoteParticipantInfo.heightInCaseOfChange
              : 0,
            statusGaze: remoteParticipantInfo
              ? remoteParticipantInfo.gazeStatus
              : '',
          };
          setHeadDirectionResults((prev) => [...prev, currentOtherEntry]);
        });

        // 各リモートユーザのデータを追加
        // let userIndex = 1;
        // remoteDataStreams.forEach((stream, memberID) => {
        //   const remoteUserLatestInfo = (stream as any)._latestData as
        //     | WindowAndAudioAndParticipantsInfo
        //     | undefined; // _latestDataは内部プロパティ
        //   if (remoteUserLatestInfo) {
        //     currentEntry[`ID`] = userIndex + 1;
        //     currentEntry[`myTheta`] = remoteUserLatestInfo.theta;
        //     currentEntry[`myDirection`] = Utils.getParticipantDirection(
        //       remoteUserLatestInfo.theta
        //     );
        //     currentEntry[`myWindowWidth`] =
        //       remoteUserLatestInfo.widthInCaseOfChange;
        //     currentEntry[`myStatusGaze`] = remoteUserLatestInfo.gazeStatus;
        //     currentEntry[`myIsSpeaking`] = remoteUserLatestInfo.isSpeaking;
        //     currentEntry[`myTranscript`] = remoteUserLatestInfo.transcript;
        //     setHeadDirectionResults((prev) => [...prev, currentEntry]);
        //   }
        //   userIndex++;
        // });
        // setHeadDirectionResults((prev) => [
        //   ...prev,
        //   { ID: participantID, condition: conditionID,
        //     startTime: startTime_HeadDirection, endTime: nowTime_HeadDirection,
        //     myTheta: myWindowAndAudioAndParticipantsInfo.theta, myDirection: Utils.getParticipantDirection(myWindowAndAudioAndParticipantsInfo.theta),
        //     myWindowWidth: myWindowAndAudioAndParticipantsInfo.widthInCaseOfChange, myStatusGaze: myWindowAndAudioAndParticipantsInfo.gazeStatus,
        //     myIsSpeaking: myWindowAndAudioAndParticipantsInfo.isSpeaking, myTranscript: myWindowAndAudioAndParticipantsInfo.transcript,
        //     otherTheta: otherUserWindowAndAudioAndParticipantsInfo.theta, otherDirection: Utils.getParticipantDirection(otherUserWindowAndAudioAndParticipantsInfo.theta),
        //     otherWindowWidth: otherUserWindowAndAudioAndParticipantsInfo.widthInCaseOfChange, otherStatusGaze: otherUserWindowAndAudioAndParticipantsInfo.gazeStatus,
        //     otherIsSpeaking: otherUserWindowAndAudioAndParticipantsInfo.isSpeaking, otherTranscript: otherUserWindowAndAudioAndParticipantsInfo.transcript
        //   }
        // ]);
        setStartTime_HeadDirection(nowTime_HeadDirection); // 計測開始時間を更新
      }
    }
  }, [
    nowTest,
    startTime_HeadDirection,
    myWindowAndAudioAndParticipantsInfo,
    remoteDataStreams,
  ]); // CSVファイルへの頭部方向・音声データの書き出し

  return (
    <div>
      <div id="active-before-conference">
        <p>
          Your ID:
          <select
            id="ID"
            onChange={(event) => {
              participantID = Number(event.target.value);
            }}
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
            <option value="7">7</option>
            <option value="8">8</option>
            <option value="9">9</option>
            <option value="10">10</option>
            <option value="11">11</option>
            <option value="12">12</option>
            <option value="13">13</option>
            <option value="14">14</option>
            <option value="15">15</option>
            <option value="16">16</option>
            <option value="17">17</option>
            <option value="18">18</option>
            <option value="19">19</option>
            <option value="20">20</option>
          </select>
          &nbsp;&nbsp; condition=
          <select
            id="condition"
            onChange={(event) => {
              conditionID = Number(event.target.value);
              switch (conditionID) {
                case 1:
                  conditionName = 'Baseline';
                  break;
                case 2:
                  conditionName = 'FrameChange';
                  break;
                case 3:
                  conditionName = 'SizeChange';
                  break;
                case 4:
                  conditionName = 'SizeChange_Discrete';
                  break;
                case 5:
                  conditionName = 'PositionChange';
                  break;
                case 6:
                  conditionName = 'PositionAndSizeChange';
                  break;
                default:
                  conditionName = '';
                  break;
              }
            }}
          >
            <option value="1">Baseline</option>
            <option value="2">FrameChange</option>
            <option value="3">SizeChange</option>
            {/* <option value="4">SizeChange_Discrete</option> */}
            {/* <option value="5">PositionChange</option> */}
            {/* <option value="6">PositionAndSizeChange</option> */}
          </select>
          &nbsp;&nbsp; room name:{' '}
          <input
            type="text"
            value={roomName}
            onChange={(e) => {
              setRoomName(e.target.value);
            }}
          />
          &nbsp;
          <button onClick={main}>join</button>
        </p>
      </div>
      <div id="active-after-conference" className="non-active">
        ID: {participantID} &nbsp;&nbsp; condition: {conditionName} &nbsp;&nbsp;
        room name: {roomName}
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <button onClick={testStart} disabled={nowTest}>
          Measurement Start
        </button>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <button onClick={testEnd} disabled={!nowTest}>
          Measurement End
        </button>
      </div>
      <video
        id="local-video"
        ref={localVideoRef}
        muted
        playsInline
        style={myWindowAndAudioContainerStyle}
      ></video>
      <Webcam
        id="local-video-webcam"
        ref={webcamRef}
        videoConstraints={{ deviceId: devices?.[0]?.deviceId }}
        muted
        playsInline
        style={myWindowAndAudioContainerStyle}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {videoSubscriptions.map((subscription) => (
          <Video
            key={subscription.id}
            subscription={subscription}
            windowInfo={remoteParticipantsInfo.get(
              subscription.publication.publisher.id
            )}
            participantNum={videoSubscriptions.indexOf(subscription) + 2} // 1番：自分自身の映るカメラ
            participantAllNums={videoSubscriptions.length + 1} // +1：自分自身の映るカメラを含むため
            // me={me}
            // isMe={subscription.publication.publisher.id === me?.id}
            // conditionID={conditionID}
          />
        ))}
      </div>
      <div ref={audioContainer} />
      <CSVLink
        data={headDirectionResults}
        filename={`C${conditionID}_ID${participantID}_headDirectionResults.csv`}
        ref={CSV_Ref}
      ></CSVLink>
    </div>
  );
};

export default App;
