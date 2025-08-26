import { RemoteVideoStream, RoomSubscription } from '@skyway-sdk/room';
import { CSSProperties, FC, useEffect, useMemo, useRef } from 'react';

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

export const Video: FC<{
  subscription: RoomSubscription<RemoteVideoStream>;
  windowInfo?: WindowAndAudioAndParticipantsInfo;
}> = ({ subscription, windowInfo }) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current && subscription.stream) {
      ref.current!.srcObject = new MediaStream([subscription.stream!.track]);
    }
  }, [ref.current, subscription.stream]);

  const style: CSSProperties = useMemo(() => {
    // WindowInfoが存在しない場合には，デフォルトスタイルを適用
    if (!windowInfo) {
      return {};
    }

    // windowInfoから動的にスタイル生成
    return {
      position: 'absolute',
      width: windowInfo.width,
      height: windowInfo.height,
      top: `calc(50% - ${windowInfo.height / 2}px + ${
        windowInfo.topDiff
      }px) + ${500 * +subscription.publication.publisher.id}px`,
      left: `calc(50% - ${windowInfo.width / 2}px + ${windowInfo.leftDiff}px)`,
      border: `10px solid rgba(${windowInfo.borderRed}, ${windowInfo.borderGreen}, ${windowInfo.borderBlue}, ${windowInfo.borderAlpha})`,
    };
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
        ref={ref}
        onClick={switchEncodingSetting}
        style={style}
      />
    </div>
  );
};
