import { RemoteVideoStream, RoomSubscription } from '@skyway-sdk/room';
import { FC, useEffect, useMemo, useRef } from 'react';

// --- Constant Valuale ---
const AppConstants = {
  WIDTH_MAX: window.innerWidth, // ビデオウィンドウの大きさの最大値
  WIDTH_MIN: window.innerWidth * 0.8, // ビデオウィンドウの大きさの最小値
  HEIGHT_MAX: window.innerHeight, // ビデオウィンドウの大きさの最大値
  HEIGHT_MIN: window.innerHeight * 0.8, // ビデオウィンドウの大きさの最小値
};

// --- Global Variables（以下すべてuseStateで管理したいが，やり方が分かっていないので，保留） ---
const scrollMyX = window.scrollX; // 自分自身（参加者側）のスクロール位置（X座標）
const gap_between_participants = 20; // 各参加者のビデオウィンドウ間の感覚

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

// --- Component Logic ---
export const Video: FC<{
  subscription: RoomSubscription<RemoteVideoStream>;
  windowInfo?: WindowAndAudioAndParticipantsInfo;
  participantNum: number;
  participantAllNums: number;
  windowMax: number;
}> = ({
  subscription,
  windowInfo,
  participantNum,
  participantAllNums,
  windowMax,
}) => {
  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);

  // --- Effects ---
  useEffect(() => {
    if (videoRef?.current && subscription.stream) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      videoRef.current!.srcObject = new MediaStream([
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        subscription.stream!.track,
      ]);
    }
  }, [videoRef?.current, subscription.stream]);

  // --- Memos ---
  const style: React.CSSProperties = useMemo(() => {
    console.log('Window Info:' + windowInfo);
    // WindowInfoが存在しない場合には，デフォルトスタイルを適用
    if (!windowInfo) {
      return {};
    }

    // eslint-disable-next-line
    // console.log("participantNum:" + participantNum); // デバッグ用
    console.log('participantAllNums = ' + participantAllNums);

    // windowInfoから動的にスタイル生成
    return {
      position: 'absolute',
      width: windowInfo?.width - gap_between_participants,
      height: windowInfo.height - gap_between_participants,
      top: `${
        0 +
        // window.screen.height / 2 - // ウィンドウを中央揃えにする
        // ↓：Zoom のギャラリービュー風レイアウト（participantNumは1から，participantNumの1番には自分自身の映るカメラが対応している）
        AppConstants.HEIGHT_MAX *
          (participantNum % 2 === 1
            ? participantNum /
              (1 + Math.floor((participantAllNums - 1) / 2)) /
              2
            : (participantNum - 1) /
              (1 + Math.floor((participantAllNums - 1) / 2)) /
              2) -
        windowInfo.height / 2 +
        windowInfo.topDiff
      }px`,
      left: `${
        window.screenLeft +
        scrollMyX +
        // window.screen.width / 2 - // ウィンドウを中央揃えにする
        // ↓：Zoom のギャラリービュー風レイアウト（participantNumは1から，participantNumの1番には自分自身の映るカメラが対応している）
        (participantAllNums % 2 === 1 && participantNum === participantAllNums
          ? AppConstants.WIDTH_MAX / 2
          : participantNum % 2 === 1
          ? AppConstants.WIDTH_MAX / 4
          : (AppConstants.WIDTH_MAX * 3) / 4) -
        windowInfo.width / 2 +
        windowInfo.leftDiff +
        0
        // (windowMax + 50) * ((participantNum - 2) + 1 - ((participantAllNums- 1) + 1) / 2) // ウィンドウを中央揃えにする
      }px`,
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
