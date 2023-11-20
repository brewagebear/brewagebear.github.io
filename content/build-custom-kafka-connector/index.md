---
title: "[Kafka] 2023 KAFKA KRU 스터디 회고 및 Custom Kafka Connector 만들기"
date: 2023-11-20 16:44:00 +0900
tags:
  - Kafka
emoji: 💻
author: 개발한입
categories: 개발 인프라
---

```toc
```

# STEP 1. 개요

<p align="center">
    <img src="https://image.yes24.com/goods/104410708/XL">
</p>
<p align="center">
    <em>그림 1. 실전 카프카 개발부터 운영까지, 고승범 저, 2021</em>
</p>

최근에 필자는 [Kafka KRU - Kafka 한국 사용자 모임](https://www.facebook.com/groups/kafka.kru)에서 주최했던 스터디에 참여하였다. 

해당 스터디는 위의 책을 토대로 약 4주간 스터디가 진행되었으며, 이에 따른 회고 및 필자가 발표했던 4주차 발표자료 중에서 커스텀 카프카 커넥터를 제작하는 부분에 대해서 포스팅을 작성해보고자 한다.

이 포스팅과 동일한 내용은 아마도 [DEVOCEAN](devocean.sk.com) 에도 올라갈 것 같으니 참고바란다.

본격적인 포스팅에 앞서 먼저 감사 인사를 드리고자한다.

## Special Thanks To.

먼저, 이러한 자리를 마련해주신 [고승범님](https://www.facebook.com/groups/440383046403024/user/100009667536716/) 그리고 [Kafka KRU](https://www.facebook.com/groups/kafka.kru) 측과 후원을 해주신 [DEVOCEAN](devocean.sk.com) 측에게도 감사 인사를 올리고 싶습니다.

덕분에 한달이라는 시간동안 많은 것들을 배우고, 재밌게 스터디에 임할 수 있었습니다.

우선, 저자이신 고승범님의 실물 영접을 할 수 있다는 점이 매우 영광스러웠습니다. 저는 2021년에 첫 회사에서 데이터파이프라인 구축에 대한 업무를 받았는데 그 때 카프카라는 개념조차 모호한 상황에서 저에게 한 줄기 희망처럼 내려온 책이 바로 승범님의 저서인 [카프카, 데이터 플랫폼의 최강자](https://www.yes24.com/Product/Goods/59789254)였습니다. 

카프카에 대해서 공부를 해보고 싶거나 하시는 분들은 승범님의 책을 적극 권장드립니다.

1. [실전 카프카 개발부터 운영까지, 2021](https://www.yes24.com/Product/Goods/104410708)
2. [카프카, 데이터 플랫폼의 최강자, 2018](https://www.yes24.com/Product/Goods/59789254)

카프카에 관심이 많은 분들이면 아래의 페이스북 그룹과 오픈채팅방에 참여하시는 것도 추천드립니다.

* [Kafka KRU(한국 KAFKA 사용자 모임) Facebook](https://www.facebook.com/groups/kafka.kru)
* [Kafka KRU(한국 KAFKA 사용자 모임) KakaoTalk 오픈채팅방](https://open.kakao.com/o/gtHtaPde)

---

## STEP 2. 스터디 회고

필자의 블로그 포스팅을 보면 알겠지만, 필자는 카프카에 문외한까지는 아니라고 볼 수 있다. 
위에서 잠깐 언급했듯이 신입일 때, 카프카라는 것의 존재를 알게되었고 그 뒤로 계속 관심을 가지면서 비록 업무와 연관관계가 없더라도 최신 버전 및 주요 이슈, 변경점에 대해서 팔로우업을 하고 있었다.

그리고 사실 실무에서도 카프카의 꽃은 어떻게 보면 컨슈머라고도 볼 수 있는데 주로 프로듀서 사이드에서 개발을 진행했다보니 상대적으로 적은 실무 경험과 독학으로 익혔던 개념에 대해서 실증을 해줄 수 있는 그런 상황을 고대하고 있었다.

그러한 상황에서 9월쯤에 Kafka KRU에서는 아래와 같은 글이 올라왔다.

![Screenshot 2023-11-16 at 14.54.39.png](https://devocean.sk.com/editorImg/2023/11/16/1aadc537a9f6532a84ba4a343f76e6d88915f72f9817e8c2aa2d4adf6e2212a9)

이때, 실무에서 발생하는 많은 트러블 슈팅과 노하우들을 얻을 수 있다고 판단하여 바로 지원하였다.

스터디는 승범님의 여러 저서 중에서도 최신 서적인 [실전 카프카 개발부터 운영까지](https://www.yes24.com/Product/Goods/104410708) 를 챕터마다 보면서 조별로 발표를 진행하면서 스터디를 진행하였고, 스터디는 온/오프라인을 병행하며 진행되었다.

1. **10/12 : 0주차 킥오프(오프라인)**
2. **10/19 ~ 11/2 : 온라인 스터디**
3. **11/09 : 오프라인 스터디 및 회식**

온라인 스터디는 아래와 같이 Zoom을 통해서 진행하였다.

![스크린샷 2023-10-19 오후 8.09.33.png](https://i.imgur.com/CQ5j76w.png)

발표가 끝난 후에는 각 챕터별 주요 개념들을 승범님께서 문제로 출제하여 다 같이 푸는 시간도 있었다.
이를 통해서 각 챕터에 대해서 리마인드를 할 수 있는 시간 또한 가질 수 있었다.

> 💡팁
>
> 저는 4조에 속했었고, 4조는 스터디 진행 전 날에 모여서 [삼색볼펜 공부법](https://www.codesoom.com/how-to-read-three-color-pen)을 통해 선행 스터디를 진행했다.
>
> 이러한 선행 스터디를 통해서 보다 발표에 집중도나 몰입도를 높일 수 있었다.

스터디라는 강제성 부여 및 다들 바쁜 와중에 임하는 자세들을 보면서 많은 자극들을 받게 되었다.

특히, 필자가 궁금했던 실무 관련한 질의응답을 오가면서 많은 인사이트를 획득할 수 있었고, 이를 통해 더 성장할 수 있는 발판을 마련하였다.

만약, 스터디를 아래의 사유 때문에 고민하고 있다면

1. **너무 기초적인 것만 하는 것 아닌가요?**
2. **카프카에 문외한이라 다소 부담스러워요.**
3. **오프라인에서 사람들을 만나는게 부끄러워요.**

하나씩 **필자의 사견**을 얘기하고자 한다.

🤔 질)  **너무 기초적인 것만 하는 것 아닌가요?**

➡️ 답)  결국 **개발자의 성장에는 에센셜한 내용**이 중요하다고 생각한다.
필자의 블로그를 보시면 아시겠지만 최근 포스팅은 커널이나 원천 기술에 대한 내용을 파헤치고 있다.

그러한 이유는 결국 에센셜한 기저지식이 새로운 기술이나 혹은 트러블 슈팅을 할 때 도움이 되었기 때문이다.
사실, 카프카를 사용할 때도 단순 컨슈머, 프로듀서 어플리케이션만 개발해서 단순 툴로 사용할 경우에는 위 사견이 안맞을 수 있다. 그러나, 필자의 생각은 실무에서는 다양한 트러블 슈팅과 장애 위험등이 도사리고 있다라고 생각한다.

결국 핵심적인 내용들을 모른다면 모래성을 쌓은 것밖에 안된다고 생각한다. 그래서 다시 기초로 돌아가서 점검할 필요도 있다고 생각한다. 위 질문의 답변은 **자신이 카프카에 대해서 얼마나 아는지에 대한 점검**을 할 수 있다고 생각한다. (물론 이미 뛰어난 지식을 가지신 분에게는 다소 적합하지 않을 수 있다.)

또한, 필자가 스터디 참여 시 가장 바랬던 점인 **실무에서의 트러블 슈팅에 대한 많은 인사이트**를 얻을 수 있기에 적극 추천하는 바이다.

🤔 질) **카프카에 문외한이라 다소 부담스러워요.**

➡️ 답) 승범님의 책을 통해 챕터별로 진도가 나가기때문에 본인의 의지만 있으면 팔로우할 수 있는 수준이라고 생각한다. 오히려 **도화지를 채울 때 배경그림을 꼼꼼히 그릴 수 있는 기회**라고 생각하기에 적극 추천하는 바이다.

🤔 질) **오프라인에서 사람들을 만나는게 부끄러워요.**

➡️ 답) 필자의 **MBTI는 I로 시작** 한다.

결론은 너무 걱정하지마시고 일단 저질러버리는 건 어떨까 생각해본다. **지원은 공짜**이기 때문이다.


## STEP 3. 커스텀 카프카 커넥터 개발하기

스터디 회고는 위에서 끝내도록 하고, 이제 실제로 커스텀 카프카 커넥터를 개발한 내용을 다뤄보고자 한다.

필자는 4조에 속했었고, 4조의 발표주제는**Schema Registry, Kafka Connect, KRaft** 였다.

필자가 발표한 자료는 아래에서 확인할 수 있다.

+ **[Schema Registry, Kafka Connecr, KRaft 발표자료](https://drive.google.com/file/d/19FOLmq9T9xh2tDQwo7kFsGYOARfJhIPI/view?usp=sharing)**

필자는 발표자료 내용 중에서 Custom Kafka Connector를 개발하여 데모를 수행했던 부분을 이번 포스팅에 작성해보고자 한다.

전체 코드는 아래를 참고하자.
+ **[데모 코드](https://github.com/brewagebear/blog-example/tree/main/kafka-example/connector)**

### STEP 3.1 Kappa 아키텍처의 대두

먼저, 우리는 Kafka Connect를 사용하는 이유에 대해서 알아야한다.
카프카는 과거에는 주로, 메시지 큐(Message Queue)와 비교가 되면서 슬슬 이름을 날리기 시작하였다고 본다.

그러나, 수 많은 버전업을 거치면서 사용자의 요구사항을 적극 반영하면서 이제는 더 이상 메시지 큐의 대체라기 보다는 그 자체가 하나의 **이벤트 스트리밍 플랫폼**이 되었다고 볼 수 있다.

이를 증명하는 것이 Kappa 아키텍처라고도 볼 수 있다. 카프카의 아버지라고 불리우는 제이 크랩스(Jay Kreps)는 2014년에 [Lambda 대체를 위한 Kappa 아키텍처를 제안](https://www.oreilly.com/radar/questioning-the-lambda-architecture/)하였다.

왜 대두가 되었는지를 알기 위해서는 우선 람다 아키텍처에 대해서 알 필요가 존재한다.

#### STEP 3.1.1 람다(Lambda) 아키텍처의 단점

아마, 알파고가 빵하고 이슈를 터트릴떄쯤 생각해본다면, 그때 IT 업계의 주요 관심사 중에 하나는 **"빅데이터"** 었다라는 것을 나의 동년배들은 알고 있을 것이다.

하둡(Hadoop)이 대두되고, 하둡을 통해 빅데이터를 분산처리를 하는 사례들이 증가함에 따라 하둡은 빅데이터 도메인에서 이슈를 해결하기 위한 매우 적합한 솔루션 중 하나라고 여겨지고 있었고, 생태계도 풍부해지고 있었다.

그러나, 하둡은 **실시간성의 처리구조는 아니었고, 배치성의 성격**을 갖고 있었다.
이를 해결하기 위한 요즘날 매우 유명한 도구들인 Spark, Flink와 같은 스트리밍 처리 프레임워크들이 발전하게 된다.

그러한 처리를 보다 도와주기 위해서 도입된 것이 바로 람다 아키텍처이다.

<p align="center">
    <img src="https://devocean.sk.com/editorImg/2023/11/16/581fa708e18b6ba0ecd5281b0032653cc82a761d927cef453d8e5cb5f978eca0">
</p>
<p align="center">
    <em><a href="https://www.databricks.com/glossary/lambda-architecture">그림 2. Lambda Architecture Overview, Databricks</a></em>
</p>

위 그림은 람다 아키텍처의 레이어들과 역할들을 나타낸다.

1. 배치 레이어(Batch Layer) : 기존에 데이터 처리를 위한 배치 프로세스
2. 스피드 레이어(Speed Layer) : 배치 레이어의 특정 단위 작업 이후 실시간 데이터를 처리하고 응답시간을 빠르게 유지하는 역할(e.g Flink, Spark 등..)
3. 서빙레이어 : 배치레이어의 배치 뷰와 스피드 레이어의 리얼-타임 뷰를 병합하여 사용자에게 결과값을 전달하는 계층

위를 보면 알겠지만, 다소 아키텍처가 복잡함을 볼 수 있다.

즉, 하둡이나 스카프같은 분산 프레임워크에서의 프로그래밍은 복잡하다. 이러한 문제 때문에 운영의 복잡성이 올라간다. 이러한 문제를 해결하기 위해 제안된 것이 바로 **Kappa 아키텍처**이다.

<p align="center">
    <img src="https://devocean.sk.com/editorImg/2023/11/16/048e67aeb8edf2efc317479c92c9e19b7466b546ed806fc059d106dbc391866e">
</p>
<p align="center">
    <em><a href="https://www.kai-waehner.de/blog/2021/09/23/real-time-kappa-architecture-mainstream-replacing-batch-lambda/">그림 3. Kappa Architecture Overview, Kai-waehner, 2021</a></em>
</p>

> 💡 참고
>
> 람다 아키텍처가 구닥다리 아키텍처라는 뜻으로는 오해않길 바란다.
>
> 모든 아키텍처는 워크로드에 따라서 선택할 수 있고, 결국은 모든 것은 트레이드-오프이다.
>
> 위 내용은 단순히 Kappa 아키텍처가 복잡했던 람다 아키텍처의 운영의 문제를 해결하는 경우의 수 중 하나일 뿐이라는 점이라 이해해야한다.
>
> 실제로, 람다 아키텍처는 현재까지도 사용되고 있다.

Lambda 아키텍처 vs Kappa 아키텍처에 대한 자세한 내용을 알고 싶으면 아래의 내용도 추천한다.

+ [Kafka Summit America 2021, It's time to stop using lambda architecture, shopify](https://www.confluent.io/events/kafka-summit-americas-2021/its-time-to-stop-using-lambda-architecture/)

#### STEP 3.1.2 Kappa 아키텍처 훑어보기

<p align="center">
    <img src="https://devocean.sk.com/editorImg/2023/11/16/1e802616b21f922f0b0f95482d3b6cf60d21541b3a12c6ddd7605b66ab714690">
</p>
<p align="center">
    <em><a href="https://www.confluent.io/events/kafka-summit-apac-2021/kafka-tiered-storage/">그림 4. Kappa Architecture at Uber, Kafka Summit APAC, 2021</a></em>
</p>

해당 이미지는 [Kafka Summit APAC 2021](https://www.confluent.io/events/kafka-summit-apac-2021/kafka-tiered-storage/) 에서 발표된 우버의 아키텍처이다.

위 아키텍처를 참고하면 이벤트들이 **매우 다양한 곳에서 발생되고, 적재되는 것들을 확인**할 수 있다.
그리고 그 중심에는 카프카가 위치해있다. 이를 통해서 다양한 확장성을 가질 수 있게끔 하는 것이 Kappa 아키텍처의 장점이라고 볼 수 있다.

서두에서 말했던 **카프카가 메인 이벤트 스트리밍 플랫폼으로 쓰이는 대표적인 예시가 Kappa 아키텍처**라 볼 수 있다.

### STEP 3.2 Kafka Connect Overview

이런식으로 카프카가 메인 이벤트 스트리밍 플랫폼으로 사용되게 되면서 또 하나의 요구사항이 발생하게 된다.

1. **다양한 곳에서 발생하는 이벤트를 편리하게 카프카로 모을 수 있는 방법이 있을까?**
2. **카프카에서 발생한 이벤트들을 다른 곳에 적재할 때 편하게 할 수 있는 방법이 있을까?**

카프카 커넥트는 위와 같은 요구사항때문에 탄생한 도구라 볼 수 있다.

<p align="center">
    <img src="https://devocean.sk.com/editorImg/2023/11/16/30f4593ff64eddce0892071e1936c4cd5ded3858cd28c2db900515832492295b">
</p>
<p align="center">
    <em><a href="https://developer.confluent.io/courses/kafka-connect/intro/">그림 5. Kafka Connect Overview, Confleunt.io - Kafka Connect 101</a></em>
</p>

위 그림을 보면 소스(Sources) <-> 카프카 사이와 카프카 <-> 싱크(Sinks)에 각각 커넥트들이 존재한다.
커넥트는 2가지 종류가 존재하는데 이를 아래와 같이 분류할 수 있다.

* **소스 -> 카프카 : 소스 커넥터(Source Connector)**
* **카프카 -> 싱크 : 싱크 커넥터(Sink Connector)**

카프카의 핵심 요소들에서 설명하면 아래와 같다.

* [Connectors](https://docs.confluent.io/platform/current/connect/index.html#connect-connectors) : Task를 관리하여 데이터 스트리밍을 조정하는 높은 수준의 추상화
* [Tasks](https://docs.confluent.io/platform/current/connect/index.html#tasks) : Kafka 에서 데이터를 가져오거나 보낼때 어떤 방식으로 할 지에 대한 구현체
* [Workers](https://docs.confluent.io/platform/current/connect/index.html#workers) : Connector 및 Task을 실행하는 실행 프로세스
* [Converters](https://docs.confluent.io/platform/current/connect/index.html#converters) : Connect와 데이터를 보내거나 받는 시스템 간의 데이터 변환을 위한 코드
* [Transfroms](https://docs.confluent.io/platform/current/connect/index.html#transforms) : Connector에서 생성되거나 전송되는 각 메시지를 변경하는 간단한 로직
* [Dead Letter Queue](https://docs.confluent.io/platform/current/connect/index.html#dead-letter-queue) : Connect가 Connector 오류를 처리하는 방법

워커의 경우에는 카프카 커넥트의 동작 모드에 따라서 몇 개의 워커가 띄워질지 결정된다.

1. [독립 실행형 모드(Stand-alone mode)](https://docs.confluent.io/platform/current/connect/index.html#standalone-workers) : 하나의 워커가 모든 커넥터와 작업 실행을 담당하는 간단한 모드
2. [분산 모드(Distributed mode)](https://docs.confluent.io/platform/current/connect/index.html#distributed-workers) : 여러개의 워커가 띄워질 수 있으며 내결함성 기능(리밸런싱이나 페일오버등)이 기능이 있는 모드

따라서, 실제 커넥트를 운영환경에서 하는 경우에는 분산모드가 권장된다.

전체 아키텍처로 보면 아래와 같다.

<p align="center">
    <img src="https://devocean.sk.com/editorImg/2023/11/16/a4b775f08e05f558a6c7052032a950b394d743e829d3b51065bd340c2ea56d80">
</p>
<p align="center">
    <em><a href="https://www.instaclustr.com/blog/apache-kafka-connect-architecture-overview/">그림 5. Kafka Connect Cluster, instaclustr, 2018 </a></em>
</p>

1. 하나 이상의 워커가 카프카 커넥트 클러스터에서 실행된다.
2. 워커는 하나 이상의 커넥터 플러그인을 갖고 있다.
    * 각 plugin은 connector와 task를 갖고 있다.
3. 워커는 topic과 task간의 데이터를 이동시킨다.
4. 워커는 connector와 task를 시작시킨다.

자세한 내용은 [Kafka Connect 101](https://developer.confluent.io/courses/kafka-connect/intro/)을 참고해보도록 하고 이제 커스텀 카프카 커넥터를 만들어보자.

---

### STEP 3.3 커스텀 카프카 커넥터 구현

#### STEP 3.3.1 Extending Docker Image

필자는 아주 간단한 소스 커넥터를 만들 예정이다.
여기서, 구현할 구성요소는 `Connector`와 `Tasks` 정도라고 말할 수 있다. (`Converter`, `Transformer` 는 발표 준비 시간관계 상 제외했다.)

**구글 폼의 응답을 저장하는 구글 시트의 데이터를 카프카에 적재**하는 소스 커넥터이다.

먼저, 편의를 위해서 [kafka-ui](https://github.com/provectus/kafka-ui)i에서 제공해주는 도커 컴포즈 파일을 수정해서 사용하고자 한다.

우선 양이 꽤 되기에 전체 소스코드가 궁금한 독자분들이라면 [kafka-example](https://github.com/brewagebear/blog-example/tree/main/kafka-example)를 참고하시길 바란다.

필자의 docker-compose 파일을 다음과 같다.

```yml
---
version: '2'
services:
  kafka-ui:
    container_name: kafka-ui
    image: provectuslabs/kafka-ui:v0.7.1
    ports:
      - 8080:8080
    depends_on:
      - kafka0
      - schema-registry0
    environment:
        ...
  kafka0:
    image: confluentinc/cp-kafka:7.2.1.arm64
    hostname: kafka0
    container_name: kafka0
    ports:
      - 9092:9092
      - 9997:9997
    environment:
        ...
    volumes:
        ...
  schema-registry0:
    image: confluentinc/cp-schema-registry:7.2.1.arm64
    ports:
      - 8085:8085
    depends_on:
      - kafka0
    environment:
        ...
  kafka-init-topics:
    image: confluentinc/cp-kafka:7.2.1.arm64
    volumes:
       - ./message.json:/data/message.json
    depends_on:
      - kafka0
    command: ...

  kafka-connect0:
    image: my-connector:latest
    ports:
      - 8083:8083
    depends_on:
      - kafka0
    environment:
        ...
```

`environment`, `command`와 같은 내용들은 생략을 했으나 전반적인 흐름은 볼 수 있을 것이다.

이 중에서 볼 내용은 `kafka-connect0` 서비스를 사용하는 이미지가 `my-connecter` 라는 이미지를 사용했다는 점이다. 필자는 해당 도커 컴포즈 파일을 활용하기 위해서 컨플루언트의 베이스 이미지를 확장해서 빌드를 수행했다.

```
FROM confluentinc/cp-kafka-connect:7.2.1
COPY ./plugins/ /usr/share/java
ENV CONNECT_PLUGIN_PATH="/usr/share/java,/usr/share/confluent-hub-components"
USER 1001
```

해당 내용은 컨플루언트의 kafka connect 공식 이미지를 베이스로 하여, 우리가 커스텀하게 개발한 커넥터의 `jar` 파일을 컨테이너에 복사한 후에 `CONNECT_PLUGIN_PATH` 에 경로에 넣기 하기 위함이다.

자세한 내용을 확인하고 싶은 독자분들은 아래의 링크를 참고하길 바란다.

* [extending-image](https://docs.confluent.io/platform/current/installation/docker/development.html#extending-images)

따라서, 위 커스텀 이미지를 활용하기 위해서 경로는 아래와 같다.

```
.
├── Dockerfile
└── plugins
   └── connector-all.jar
```

즉, `plugins` 폴더 아래에 커스텀 커넥터 `jar` 파일을 위치하면 된다.

#### STEP 3.3.2 Gradle Plugin

사실, 커스텀 커넥트를 만들면서 많이 힘들었던 부분은 저런 식으로 도커 이미지를 등록해놨음에도 불구하고, 계속해서 `jar` 파일을 추가가 안되는 문제가 존재했다.

대부분의 커넥트들은 Maven 기반으로 빌드되어 있는 것을 확인하였는데 이때, 일반적인 `jar`로 빌드를 하는 것이 아닌 Dependency까지 포함된 `fat-jar`로 빌드를 해야되는 것을 확인할 수 있었다.

이를 그래들에서 작업하려면 다소 귀찮은 부분들이 존재하는데 이를 해결해주는 플러그인이 바로 `gradle-shadow` 이다.


<p align="center">
    <img src="https://devocean.sk.com/editorImg/2023/11/16/edb87322483bfd00891ef1de08dc273d13b529b9c698511bfc70285f3d79b24b">
</p>
<p align="center">
    <em><a href="https://imperceptiblethoughts.com/shadow/introduction/">그림 6. Gradle Shadow Plugin</a></em>
</p>

소개 글을 보면 알 수 있듯이 아주 간편하게 `fat-jar`를 만드는 것을 도와주는 플러그인이다.

```kts
description = "Kafka Connector Module"

plugins {
    id(Plugins.gradle_shadow) version Plugins.Versions.gradle_shadow
}

dependencies {
    implementation(Dependencies.kafka_connect_api)
    implementation(Dependencies.google_api_client)
    implementation(Dependencies.google_sheet_api)
    implementation(Dependencies.google_oauth_client)

    implementation(Dependencies.slf4j)

    compileOnly(Dependencies.lombok)
    annotationProcessor(Dependencies.lombok)
}

tasks.test {
    useJUnitPlatform()
}

java {
    toolchain {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}
```

위의 `build.gradle.kts`가 실제 `gradle-shadow` 플러그인을 사용한 내용이라고 볼 수 있고, 이는 `./gradlew` 명령어든 아니면 IDE에서 간단하게 Task로 클릭해서 처리하여 `fat-jar`를 만들 수 있다.

![Screenshot 2023-11-16 at 19.56.42.png](https://devocean.sk.com/editorImg/2023/11/16/e3822dca88bd8fff3f9ac2f93e9b978abe6a3265d0d98aef69c834dda04ed43f)

Intellj 기준에서 보면 `shadowJar` 태스크가 그러한 역할을 해준다고 보면 된다.

## STEP 4. 실제 커넥트 컴포넌트 구현

```kts
dependencies {
    implementation(Dependencies.kafka_connect_api)
    implementation(Dependencies.google_api_client)
    implementation(Dependencies.google_sheet_api)
    implementation(Dependencies.google_oauth_client)

    implementation(Dependencies.slf4j)

    compileOnly(Dependencies.lombok)
    annotationProcessor(Dependencies.lombok)
}
```

필자는 구글 시트 API를 활용하기 위해서 구글 시트 API와 GCP 연동을 처리하는 API Client, OAuth Client을 의존성을 추가해줬고, 실제 Connect 개발을 위해서 카프카 커넥트 API도 추가해줬다.

우리가 중점으로 볼 내용은 커넥트 내용이기 때문에 구글 서비스 관련해서는 아래의 링크를 참고하자.

* [kafka-example, googleService](https://github.com/brewagebear/blog-example/blob/main/kafka-example/connector/src/main/java/io/github/brewagebear/GoogleSheetService.java)

이제 이 구현을 해나가는 과정을 살펴보자.

### STEP 4.1 설정 컴포넌트

* `SimpleGoogleSheetSourceConfig`

```java
//https://github.com/brewagebear/blog-example/blob/main/kafka-example/connector/src/main/java/io/github/brewagebear/SimpleGoogleSheetSourceConfig.java
public class SimpleGoogleSheetSourceConfig extends AbstractConfig implements CustomConnectConfig {

    public static final String TASK_ID = "task.id";
    public static final String TASK_MAX = "task.max";
    public static final String TOPIC_NAME_CONFIG = "topic";
    public static final String POLL_INTERVAL_CONFIG = "poll.interval.ms";
    public static final long POLL_INTERVAL_DEFAULT = 1000;

    public SimpleGoogleSheetSourceConfig(final Map<?, ?> props) {
        super(CONFIG_DEF, props);
        log.info("{}", props);
    }

    public Map<String, String> getGoogleCredential() {
        ...
        return map;
    }

    public int getFetchSize() { return getInt(GOOGLE_SPREAD_SHEET_FETCH_SIZE_CONFIG); }

    public String getTopicName() {
        return getString(TOPIC_NAME_CONFIG);
    }

    public long getPollInterval() {
        return getLong(POLL_INTERVAL_CONFIG);
    }
```

이 클래스의 경우에는 커넥트를 연결할 때 필요한 설정 값에 대한 필수 인자 혹은 기본 값 등을 설정하는 클래스이다. `AbstractConfig` 을 상속받아서 구현하였으며, `CustomConnectConfig` 인터페이스 내부에 각 필수 설정값, 기본값 그리고 중요도와 각 설정값들이 나타내는 정보들을 담아두었다.

* `CustomConnectConfig`

```java
//https://github.com/brewagebear/blog-example/blob/main/kafka-example/connector/src/main/java/io/github/brewagebear/CustomConnectConfig.java
public interface CustomConnectConfig {
    ConfigDef CONFIG_DEF =
            new ConfigDef()
                    .define(SimpleGoogleSheetSourceConfig.TOPIC_NAME_CONFIG,
                            ConfigDef.Type.STRING,
                            ConfigDef.Importance.HIGH,
                            "Topic name.")
                    .define(SimpleGoogleSheetSourceConfig.POLL_INTERVAL_CONFIG,
                            ConfigDef.Type.LONG,
                            SimpleGoogleSheetSourceConfig.POLL_INTERVAL_DEFAULT,
                            ConfigDef.Importance.HIGH,
                            "Max interval between messages (ms)")
                    .define(GoogleCredentialsConfig.GOOGLE_SERVICE_PROJECT_ID_CONFIG,
                            ConfigDef.Type.STRING,
                            ConfigDef.Importance.HIGH,
                            "Google Cloud Platform Project id")
                 ...
```

이 값들을 토대로 커넥트가 셋업이 된다고 보면된다.

### STEP 4.2 커넥터 컴포넌트

이제 실제 커넥터 부분을 보자.

```java
//https://github.com/brewagebear/blog-example/blob/main/kafka-example/connector/src/main/java/io/github/brewagebear/SimpleGoogleSheetConnector.java
public class SimpleGoogleSheetConnector extends SourceConnector {

    private Map<String, String> configProps;

    @Override
    public void start(Map<String, String> props) {
        log.info("Starting Google Sheet Source -> {}", props);
        configProps = props;
    }

    @Override
    public Class<? extends Task> taskClass() {
        return SimpleGoogleSheetTask.class;
    }

    @Override
    public List<Map<String, String>> taskConfigs(int maxTasks) {
        log.info("Setting task configurations for {} workers.", maxTasks);

        final List<Map<String, String>> configs = new ArrayList<>(maxTasks);

        for (int i = 0; i < maxTasks; ++i) {
            final Map<String, String> taskConfig = new HashMap<>(configProps);
            // add task specific values
            taskConfig.put(TASK_ID, String.valueOf(i));
            taskConfig.put(TASK_MAX, String.valueOf(maxTasks));
            configs.add(taskConfig);
        }
        return configs;
    }

    @Override
    public void stop() {
        log.info("Stopping Google Sheet Source");
    }

    @Override
    public ConfigDef config() {
        return SimpleGoogleSheetSourceConfig.CONFIG_DEF;
    }

    @Override
    public String version() {
        return "1.0";
    }
}
```

커넥트 API의 `SourceConnector` 를 상속받아서 구현하였으며, 각 태스크의 유니크 값인 `TASK_ID`와 몇 개의 태스크를 돌릴 것인지에 대한 `TASK_MAX` 값 등을 셋업한다.

`config()` 메서드를 보면 우리가 설정한 커스텀 설정을 불러오는 것을 알 수 있는데 이는 우리가 설정을 입력할 때, 이 메서드를 통해서 밸리데이션 처리가 된다.

이런식으로 초기에 plugin이 등록될 때, `SourceConnector`에 대한 정보들이 들어가고, 실제 시작 트리거가 발생하면 `Task` 클래스를 호출하는 식으로 동작을 하게 된다.

### STEP 4.3 태스크 컴포넌트

소스 커넥터의 태스크는 실제 Source에서 데이터를 읽어와서 카프카에 적재하는 매커니즘으로 동작한다.

```java
//https://github.com/brewagebear/blog-example/blob/main/kafka-example/connector/src/main/java/io/github/brewagebear/SimpleGoogleSheetTask.java
public class SimpleGoogleSheetTask extends SourceTask {
    ...

    public SimpleGoogleSheetTask() {
        this.time = new SystemTime();
        this.lastPollMs = time.milliseconds();
    }

    @Override
    public void start(Map<String, String> props) {
        log.info("Starting Google Sheet task with config: {}", props);
        config = new SimpleGoogleSheetSourceConfig(props);
        googleSheetService = new GoogleSheetService(config.getGoogleCredential());

        taskId = props.get("task.id");
        range = getNextRange(2);
        fetchSize = config.getFetchSize();

        sheets = googleSheetService.connect();
        running.set(true);

        // get offsets for a specific task id
        final Map<String, Object> offset =
                context.offsetStorageReader().offset(Collections.singletonMap(TASK_ID, taskId));

        if (offset != null) {
            final Long currentOffset = (Long) offset.get(POSITION_NAME);
            if (currentOffset != null) {
                lastProcessedOffset = currentOffset;
            } else {
                // no position found
                lastProcessedOffset = 0L;
            }
        } else {
            // first time there is no offset.
            lastProcessedOffset = 0L;
        }
    }

    @Override
    public List<SourceRecord> poll() {
        log.debug("Polling for new data");

        final long timeSinceLastPollMs = time.milliseconds() - lastPollMs;

        if (timeSinceLastPollMs < config.getPollInterval()) {
            log.debug("Sleep, time since last poll = {}", timeSinceLastPollMs);
            time.sleep(DEFAULT_WAIT_MS);
            return null;
        }

        if (!running.get()) {
            return null;
        }

        List<SourceRecord> records = new ArrayList<>();

        try {
            List<List<String>> data = googleSheetService.getResponse(sheets, range);

            if (data != null && !data.isEmpty()) {
                for (List<String> row : data) {
                    records.add(new SourceRecord(Collections.singletonMap(TASK_ID, taskId),
                            Collections.singletonMap(POSITION_NAME, lastProcessedOffset),
                            config.getTopicName(),
                            Schema.STRING_SCHEMA, row.get(0),
                            Schema.STRING_SCHEMA, row.get(1)
                    ));

                    lastProcessedOffset += 1;
                }

                log.info("polling data {}", records);
                range = getNextRange(lastRow);
                log.info("next range {}", range);
            } else {
                stop();
            }

            lastPollMs = time.milliseconds();

        } catch (IOException e) {
            throw new RuntimeException(e);
        }

        return records;
    }

    private String getNextRange(int lastRange) {
        updateLastRow();
        int endRow = lastRange + fetchSize - 1;
        return "A" + (lastRange) + ":B" + (endRow);
    }

    private void updateLastRow() {
        this.lastRow += fetchSize;
    }

    @Override
    public void stop() {
        running.set(false);
    }

    @Override
    public String version() {
        return "1.0";
    }
}
```

1. `start()` 메서드가 호출되면 우리가 입력한 설정 값을 토대로 초기 셋업이 수행된다. 여기서는 오프셋의 초기화 등의 작업과 필자가 사용한 `GoogleSheetService` 에 대한 초기 커넥션 수립등을 진행한다.
2. `poll()` 메서드는 Source에서 데이터를 불러와 카프카에 적재 후 커밋하는 작업들이 수행된다. 보면 마지막 오프셋에 대한 처리 및 Source의 데이터를 `SourceRecord` 에 담아서 리턴을 하는 작업들이 보이는데 이를 토대로 카프카에 적재를 하게 된다.

### STEP 4.4 Running Task

필자는 해당 프로젝트에 샘플 컨피그를 등록해두었다.

```java
{
  "name": "google-sheet-source",
  "config": {
    "connector.class": "io.github.brewagebear.SimpleGoogleSheetConnector",
    "topic": "sheet-data",
    "key.converter": "org.apache.kafka.connect.storage.StringConverter",
    "value.converter": "org.apache.kafka.connect.json.JsonConverter",
    "value.converter.schemas.enable": "true",
    "tasks.max": "1",
    "poll.interval.ms": "50000",
    "project_id": "project_id",
    "private_key_id" : "private_key_id",
    "private_key" : "-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----\n",
    "client_email" : "test.iam.gserviceaccount.com",
    "client_id": "client_id",
    "sheet_id" : "1U_Q4qWeIzrXezL8CERnfxwNNxfNZlyyVwG0mujTKJZY"
  }
}
```

이러한 JSON 파일이 있다고 가정했을 때 Kafka Connect API 를 통해서도 등록할 수 있다.

* JSON 유효성 검사

```sh
curl -X PUT -H "Content-Type: application/json" -d @./google-sheet-source.json http://localhost:8083/connector-plugins/SimpleGoogleSheetConnector/config/validate
```

* 실제 커넥터 등록

```sh
curl -X POST -H "Content-Type: application/json" -d @./google-sheet-source.json http://localhost:8083/connectors
```

위에 얘기한 도커 컴포즈를 쓰는 경우에는 매우 간단하게 처리를 할 수 있다.

![Screenshot 2023-11-16 at 21.45.11.png](https://devocean.sk.com/editorImg/2023/11/16/41f4b9e250f97cf6f4da66d0b2cd5cb99f5b49feb6e533c218403e875ccfe0ed)

해당 화면을 들어온 뒤에 `Create Connectors` 버튼을 클릭한다.

![Screenshot 2023-11-16 at 21.45.58.png](https://devocean.sk.com/editorImg/2023/11/16/05a51234bf373d5e4080700c93275a46836e171420b5f8d119c6038f7eb1bbda)

위 JSON 파일 중에서 `config` 블록에 해당하는 내용만 추가하고 `Submit` 버튼을 누른다.

![Screenshot 2023-11-16 at 21.47.34.png](https://devocean.sk.com/editorImg/2023/11/16/9b671968f3029eea9645e85a8df24be0c69dc1c04602c8fcf091c96f0efad87c)

설정 값이 정상적이라면 위와 같이 정상등록이 될 것이다.
그 이후 태스크가 수행될 것인데 에러가 없다면 아래와 같이 정상 동작을 하게 된다.

![Screenshot 2023-11-16 at 21.48.04.png](https://devocean.sk.com/editorImg/2023/11/16/c0aae423ad67e0d32d224e74a410b29d8c63eb811f17e5b2e47790518afc697e)

실제 토픽메시지를 봐도 정상적으로 인입되는 것을 확인할 수 있다.

![Screenshot 2023-11-16 at 21.48.34.png](https://devocean.sk.com/editorImg/2023/11/16/437685f9c83c83678b0fe41c2668f08e441dbc994821b2c1a99fd23d826e5b92)

### STEP 4.5 트러블슈팅

필자가 작성한 도커를 활용할 경우에는 제일 첫번째로 플러그인 패스에 정상 등록되었는지를 확인해야한다.

![Screenshot 2023-11-16 at 21.49.54.png](https://devocean.sk.com/editorImg/2023/11/16/40bb077462b543c9b9f05bbbf467adbfcdb16678e27b3d79089182a29f2ce718)

도커 로그를 확인하니 필자의 이미지를 통해서 `fat-jar`가 정상적으로 등록된 모습을 볼 수 있다.

![Screenshot 2023-11-16 at 21.27.24.png](https://devocean.sk.com/editorImg/2023/11/16/72627426a9c193c5612176a8230893f0057dd6c1a430d48d822e74f1aebd933f)

또한, 소스에서 카프카로 정상적으로 인입되는 로그 또한 확인할 수 있었다.

## STEP 5. 결론

아주 간단한 커스텀 카프카 커넥트를 만드는 것을 보여줬었다. 이처럼 카프카 커넥트 API를 활용하면 생각보다 많은 곳에 활용할 수 있다.

커스텀 카프카 커넥트에 대한 내용이 잘 없어서 깃허브를 참고하면서 작업했었는데 다른 사람은 슬랙 채널 메시지를 카프카로 전송하는 커넥트를 만든 것도 있었다.

이처럼 아주 다양한 곳에 쓰일 수 있으니 이번 기회에 한번 알아보는 것은 어떨까?

## STEP 6. 추신

스터디 회고와 커스텀 카프카 커넥트를 만든 내용에 대해서 한번 공유를 드려봤습니다.

![IMG_3213.jpeg](https://devocean.sk.com/editorImg/2023/11/16/d0d474ab450c09bbdcbbfe3ecf1f886e0abea65f001d5569c1ddef1326c7d8cf)

다시 한번 이러한 자리를 마련해주신 Kafka KRU와 데보션분들께 매우 감사하다는 말씀을 전달드리고 싶습니다.

만약, 기회가 된다면 꼭 참여해보시길 적극 추천드립니다!

그리고 승범님의 저서인 [실전 카프카 개발부터 운영까지](https://www.yes24.com/Product/Goods/104410708) 와 [카프카, 데이터 플랫폼의 최강자](https://www.yes24.com/Product/Goods/59789254)는 매우 좋은 책이니 스터디 참여를 안하시더라도 카프카에 관심이 있으신 분들께서는 읽어보시기를 추천드립니다.

아울러 다양한 카프카 주제와 질답이 오가는 커뮤니티인 Kafka KRU에 지금 참여해보시는 걸 추천드립니다.

* [Kafka KRU(한국 KAFKA 사용자 모임) Facebook](https://www.facebook.com/groups/kafka.kru)
* [Kafka KRU(한국 KAFKA 사용자 모임) KakaoTalk 오픈채팅방](https://open.kakao.com/o/gtHtaPde)

읽어주셔서 감사합니다.

# 레퍼런스
1. [Lambda Architecture, Databricks](https://www.databricks.com/glossary/lambda-architecture)
2. [빅데이타 분석을 위한 람다 아키텍쳐 소개와 이해, 조대협님](https://bcho.tistory.com/984)
3. [Questioning the Lambda Architecture, O'Reilly, 2014](https://www.oreilly.com/radar/questioning-the-lambda-architecture/)
4. [Kafka Connect 101, Confluent.io](https://developer.confluent.io/courses/kafka-connect/intro/)
5. [Kappa Architecture is Mainstream Replacing Lambda, Kai Waehner, 2018](https://www.kai-waehner.de/blog/2021/09/23/real-time-kappa-architecture-mainstream-replacing-batch-lambda/)
6. [Confluent Documenatation - Kafka Connect](https://docs.confluent.io/platform/current/connect/index.html)
7. [How to Build Your Own Kafka Connect Plugin, inovex, 2023](https://www.inovex.de/de/blog/how-to-build-your-own-kafka-connect-plugin/)

# 읽을거리
1. [Schema Registry, Kafka Connecr, KRaft 발표자료, 개발한입, 2023](https://drive.google.com/file/d/19FOLmq9T9xh2tDQwo7kFsGYOARfJhIPI/view?usp=sharing)
2. [발표 데모 코드, 개발한입, 2023](https://github.com/brewagebear/blog-example/tree/main/kafka-example/connector)
3. [Kafka Summit APAC 2021, Kafka Tiered Storage](https://www.confluent.io/events/kafka-summit-apac-2021/kafka-tiered-storage/)
4. [Kafka Summit America 2021, It's Time To Stop Using Lambda Architecture](https://www.confluent.io/events/kafka-summit-americas-2021/its-time-to-stop-using-lambda-architecture/)
5. [Kafka Connect Extending Docker Image, Confluent](https://docs.confluent.io/platform/current/installation/docker/development.html#extending-images)
6. [gradle-shadow User Guide](https://imperceptiblethoughts.com/shadow/introduction/)
