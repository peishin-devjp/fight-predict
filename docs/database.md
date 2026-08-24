# DB設計

## 設計方針

MVPでは必要最小限のテーブルのみ作成する。

ランキング用テーブルは作成せず、予想データ・試合結果などから都度計算して表示する。

現時点の主要テーブルは以下とする。

-   `User`：ユーザー
-   `Fighter`：選手
-   `Event`：大会
-   `Fight`：試合
-   `Prediction`：予想
-   `Odds`：オッズ

------------------------------------------------------------------------

# User（ユーザー）

## 用途

ユーザー情報を管理する。

## 主なデータ

-   `id`：ユーザーID
-   `name`：ユーザー名
-   `email`：メールアドレス
-   `password`：パスワード
-   `createdAt`：登録日時

------------------------------------------------------------------------

# Fighter（選手）

## 用途

選手情報を管理する。

## 主なデータ

-   `id`：選手ID
-   `name`：選手名
-   `createdAt`：登録日時

## Fightとのrelation

FightからFighterへの参照は、役割を区別して管理する。

-   選手1（fighter1）
-   選手2（fighter2）
-   勝者（winner）

同じFightとFighterの間に複数のrelationが存在するため、Prismaでは名前付きrelationとして区別する。

※将来的に戦績・所属・階級・表記名などの追加を検討する。

------------------------------------------------------------------------

# Event（大会）

## 用途

大会情報を管理する。

## 主なデータ

-   `id`：大会ID
-   `name`：大会名
-   `date`：開催日時
-   `deadline`：予想提出締切日時
-   `createdAt`：登録日時

## 補足

日時はDBではDateTimeとして保持し、画面表示時に日本時間・日本向け形式へ整形する。

------------------------------------------------------------------------

# Fight（試合）

## 用途

大会ごとの試合情報と試合結果を管理する。

## 主なデータ

-   `id`：試合ID
-   `eventId`：大会ID
-   `fighter1Id`：選手1のFighter ID
-   `fighter2Id`：選手2のFighter ID
-   `status`：試合ステータス
-   `winnerId`：勝者のFighter ID
-   `method`：勝敗方法
-   `createdAt`：登録日時

※ `status` / `winnerId` / `method` / `winner relation`
は仕様確定済みで、次のPrisma schema変更で実装予定。

## 試合ステータス（status）

`FightStatus`として以下の5種類で管理する。

-   `scheduled`：試合予定・結果未確定
-   `finished`：勝者が決まった試合
-   `draw`：引き分け
-   `no_contest`：ノーコンテスト
-   `cancelled`：試合中止

初期値は`scheduled`とする。

## 勝者（winnerId）

`Fighter`へのrelationとして管理する。

-   `finished`：勝者のFighter IDを保持
-   `scheduled`：`null`
-   `draw`：`null`
-   `no_contest`：`null`
-   `cancelled`：`null`

`winnerId`はnullableとする。

`finished`の場合にのみwinnerIdを持つという整合性は、Backend側でもバリデーションする。

## 勝敗方法（method）

`FightMethod`として以下の2種類で管理する。

-   `decision`：判定
-   `finish`：KO / TKO / 一本などによる決着

該当しない場合は`null`とするため、`method`はnullableとする。

## Fighterとのrelation

FightからFighterへ以下の3種類のrelationを持つ。

-   `fighter1`：`fighter1Id`が参照する選手
-   `fighter2`：`fighter2Id`が参照する選手
-   `winner`：`winnerId`が参照する勝者

同じ2モデル間に複数relationが存在するため、名前付きrelationで区別する。

## ポイント計算との関係

-   `finished`かつ予想的中 → 配分ポイント × 難易度倍率
-   `finished`かつ予想外れ → 0pt
-   `draw` / `no_contest` / `cancelled` → 配分ポイントを等倍返却
-   `scheduled` → ポイント計算しない

※MVPでは「選手1」「選手2」で管理する。
将来的に必要であれば「赤コーナー」「青コーナー」への変更を検討する。

------------------------------------------------------------------------

# Prediction（予想）

## 用途

ユーザーが各試合に対して行った勝者予想と配分ポイントを管理する。

## 主なデータ

-   `id`：Prediction ID
-   `userId`：ユーザーID
-   `fightId`：試合ID
-   `predictedWinnerId`：予想勝者のFighter ID
-   `point`：配分ポイント
-   `createdAt`：登録日時

## 一意制約

同じユーザーが同じ試合について複数Predictionを持たないよう、`userId + fightId`の組み合わせをuniqueとする。

同じ試合の予想を再確定した場合は、新規レコードを重複作成せず既存Predictionを更新する。

## ポイント配分ルール

MVPでは1大会につき100ptを配分する。

-   0〜100ptは保存可能
-   100pt未満でも保存可能
-   未使用ポイントは失効
-   100pt超過は保存不可
-   全試合へのポイント配分は必須ではない
-   1試合に100ptすべて配分することも可能

100pt制約はFrontendとBackendの両方で確認する。

Frontendではユーザーへの即時フィードバックと不要なPOST防止を担当し、BackendではAPIを直接呼ばれた場合も不正データがDBへ保存されないようデータ整合性を担保する。

------------------------------------------------------------------------

# Odds（オッズ）

## 用途

試合ごとの難易度倍率算出に使用するオッズ情報を管理する。

## 現在の方針

難易度倍率はユーザー全体の予想割合を主な材料とし、サービス初期はユーザー予想データが少ないため、外部情報による補助を検討する。

オッズは大会開始時点で確定させる想定。

※オッズ計算ロジック・参照元・具体的なカラム構成は別途`odds.md`および今後の設計で管理する。

------------------------------------------------------------------------

# 試合結果からランキングまでの流れ

次のマイルストーンでは、以下の流れを実装する。

1.  ユーザーがPredictionを登録
2.  Fightに試合結果を登録
3.  `Fight.status`と`winnerId`を基に的中・外れ・返却対象を判定
4.  Predictionの配分ポイントと難易度倍率から獲得ポイントを計算
5.  対象大会の結果を集計
6.  直近3大会の獲得ポイントを集計してランキングを生成

ランキング自体はDBへ保存せず、必要なデータから都度計算する。

------------------------------------------------------------------------

# MVPで作成しないテーブル

## rankings

ランキング専用テーブルは作成しない。

Prediction・Fightの結果・ポイント計算に必要なデータから、その都度ランキングを生成する。

MVPのランキング対象は直近3大会の合計を基本とする。

## event_predictions

MVPでは作成しない。

大会単位の提出管理や提出日時管理が必要になった場合に追加を検討する。

------------------------------------------------------------------------

# 今後のDB変更予定

次のPrisma schema変更では、Fightの試合結果管理として以下を追加する予定。

-   `FightStatus` enum
-   `FightMethod` enum
-   `Fight.status`
-   `Fight.winnerId`
-   `Fight.method`
-   `Fight.winner` relation
-   `Fighter`側の逆向きrelation

変更後は以下の順で確認する。

1.  `schema.prisma`変更
2.  `npx prisma validate`
3.  Migration
4.  Prisma Client再生成
5.  Prisma Studioでカラム確認
