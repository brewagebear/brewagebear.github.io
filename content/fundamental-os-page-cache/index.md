---
title: 왜 처리량이 중요한 JVM 어플리케이션은 vm.swappiness = 1로 설정하라고 할까?
date: 2023-06-19 19:40:00 +0900
tags:
  - Operating System
  - JVM
  - Fundamental
emoji: 💻
author: 개발한입
categories: 개발 인프라 
---

```toc
```

- STEP 1. 서론
  - STEP 1.1 과거의 이야기
  - STEP 1.2 번외) NVMe를 스왑 영역으로 잡으면 RAM과 속도가 비슷할까?
- STEP 2. 본론
  - STEP 2.1 운영체제의 캐시 영역과 스와핑
    - STEP 2.1.1 캐시영역
    - STEP 2.1.2 스와핑
    - STEP 2.1.3 운영체제의 메모리 재할당 방식 
  - STEP 2.2 자바, 페이지 캐시 그리고 가비지 컬렉션
    - STEP 2.2.1 페이지 캐시와 더티 페이지 동기화 
    - STEP 2.2.2 자바 메모리와 가비지 컬렉션
- STEP 3. 결론 
- STEP 4. 참고자료 

# STEP 1. 서론

카프카 핵심가이드를 읽으면서, 챕터 1의 운영체제 튜닝하기(p.40) 부분을 보면서 궁금한 점이 생겨났다. 

> 대부분의 어플리케이션, 특히 처리량이 중요한 어플리케이션에서는 (거의) 어떻게 해서든 스와핑을 막는 것이 최선이다. 
>
>  -카프카 핵심가이드, p.40- 

당연히, 운영체제 레벨에서 지원하는 가상 메모리는 실제 메모리가 아니고 디스크를 임시로 메모리처럼 사용하는 방식이기에 이 부분은 **처리량이 중요한** 어플리케이션이면 사용하지 않는 것이 맞다는 생각은 들었으나 정확히 왜? 라는 부분에 대해서는 궁금증이 생겼다.

이 내용은 카프카 뿐만아니라 ES에도 정리가 되어있다.
+ [Disable swapping - Elasticsearch Guide 8.8](https://www.elastic.co/guide/en/elasticsearch/reference/current/setup-configuration-memory.html)

이 부분에 대해서 정리를 해보고자 한다.

물론, 독자분들이 스왑(가상 메모리) 영역에 대한 기본적인 개념이 있다고 가정하고 서술할 내용이니 이 부분을 잘 모른다면 다른 블로그나 기타 자료를 참고해보기 바란다.

## STEP 1.1 과거의 이야기

리눅스를 직접 설치한지가 벌써 10년 전으로 기억하는데 그때 당시만 해도, 스왑 영역에 대한 가이드로 대부분의 블로그에 아래와 같은 글들이 많이 보였다. 

> 스왑 영역은 RAM의 2배정도 크기로 할당한다. 

사실, 이 내용은 레드햇 공식 가이드에 있던 내용으로 인해서 구전되던 내용이 여러번 희석되서 해당 시스템의 메모리 2배를 할당한다고 내려온거지 않을까? 생각해본다.

아래는 현재 RHEL 9의 스왑 영역에 대한 가이드이다. 

<p align="center">
    <img src="https://i.imgur.com/5q8qYzf.png">
</p>
<p align="center">
    <em>그림 1. <a href="https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/managing_storage_devices/getting-started-with-swap_managing-storage-devices">RHEL Recommended System Swap Space</a></em>
</p>

학생때는 스왑 메모리에 대한 이해가 없이 사용하다보니 위와 같은 가이드를 따르기 보다는 통상 2배로 설정하라해서 그대로 따랐던 기억이 있다. 

하지만, 요즘날과 같이 물리 메모리(RAM)이 저렴해진 환경에서 스왑이 굳이 필요할까? 이러한 생각도 들게되었다. 

이 부분은 서버 엔지니어분들이 많이 계신 커뮤니티인 2cpu에 많은 질답이 오고간 것을 확인할 수 있다.

1. [Ubuntu Swap 파티션 크기 - 2cpu](https://www.2cpu.co.kr/QnA/477563#c_477565)
2. [요즘같이 메모리 큰 환경에서 리눅스 스왑영역은 어떻게 잡으세요? - 2cpu](https://www.2cpu.co.kr/bbs/board.php?bo_table=QnA&wr_id=556001)

1번은 15년도에 올라온 질문글이고, 2번은 16년도에 올라온 질문글임을 확인할 수 있다.

1번 질문 글의 경우에는 김한구님께서 답변해주신 내용이 인상 깊었다.

> 스왑 파티션이라는 것이 옛날에 물리적인 메모리가 부족하던 시절, 하드 디스크를 메모리처럼 사용하려고 만들어진 것인데 메모리가 128기가인 경우에는 부족할 것 같지 않으니 필요가 없어보인다. 그러나, 스왑을 안잡으면 경고 메시지가 뜰테니 대략 2-4기가 정도만 잡아도 충분해보인다.

레드햇의 가이드와 매우 흡사해보인다. 

2번 질문 글의 경우에는 2가지 답변이 인상 깊었다.

+ 깡통이님 

> 스왑의 사용할 때의 장점은 2가지입니다. 
> 1. 스왑이 있으면 실제 메모리 이상으로 사용했을 때 다운되지 않고, 느려지면서 동작 
> 2. 스왑이 있으면 OS는 거의 사용하지 않는 메모리 영역을 스왑으로 내리고,  확보된 공간을 디스크 캐쉬로 돌릴 수 있다.
> 
> 스왑을 사용해서 느려지는건 싫지만, 1번의 경우때문에 스왑을 사용하게 하고 싶으면 적당히 잡고 vm.swappiness를 0 ~ 10 사이로 설정해서 최대한 물리메모리를 사용하도록 설정하면 됩니다. 

+ 박님

> 어플리케이션에 따라서도 달라집니다. 
> 오라클의 경우 메모리의 3배를 권장하기도하고, 특수한 경우 메모리의 내용을 덤프 받기 위해 최소 메모리 용량만큼의 스왑 공간을 요구하는 경우도 있습니다.

또한, 다른 분께서는 스왑을 사용하는 이유에 최대절전모드(hibernation)을 얘기도 했는데 이 부분은 [Ubuntu Linux Hibernation - 권남](https://kwonnam.pe.kr/wiki/linux/ubuntu/hibernation) 를 참고해보자. 아마 최대절전모드가 동작할 때 스왑 영역을 활용하는 것으로 보인다.

종합을 해보면 아래와 같은 결론을 내릴 수 있을 것이다. 

+ 가용한 물리적 메모리와 어플리케이션의 사용량에 따라 스왑을 적절하게 설정할 수 있다. 
	+ 만약, 필요가 없다 가정하면 아예 설정을 하지않을 수 있다.
+ 스왑 영역을 세팅한다면 실제 RAM을 초과해도 속도는 느려지겠지만 시스템 다운은 막을 수 있다.

## STEP 1.2 번외) NVMe를 스왑 영역으로 잡으면 RAM과 속도가 비슷할까?

혹자는 이런 생각을 할 수 있을 것이다.

> 아니 NVMe를 사용하면, 거의 RAM과 속도가 비슷할테니 NVMe를 꽂은 후 이를 스왑 영역으로 잡으면 사실 상 램이 증설된 효과를 주는거 아닌가요?

물론, 현재 NVMe가 DDR2의 속도를 따라잡긴했다. 하지만, DDR4는 일반적으로 20GB/s 속도이고, NVMe는 4개의 PCIe 레인을 사용하고, PCIe 3.0 기준으로 8GB/s의 속도를 가지게 된다.

물론 레인(4개가 아닌 16개)을 증설하거나 PCIe 인터페이스 버전이 4.0일 경우에는 또 달라질 것이다.  하지만 이 글을 쓰는 시점에서 RAM은 DDR5 시대가 도래했고, PCIe 3.0 vs PCIe 4.0 차이에 대한 기사를 보니 성능차이가 미미하다는 점도 있다. 

참고 : [NVMe 'PCIe 3.0 vs PCIe 4.0' 성능? 어라, 차이없네](http://www.weeklypost.kr/news/articleView.html?idxno=4258)

그리고 위와 같은 가정도 **순차적인 읽기 쓰기만 고려한 점**이라는 것이다. RAM의 가장 중요한 기능 중 하나는 **랜덤 액세스**인데 위와 같은 가정도 **랜덤 액세스로 비교를 하게되면 NVMe의 성능은 고대의 SDRAM과 비교할 수 없을 정도로 느리다.**

그래도, HDD보다는 NVMe나 SSD를 사용하는 것이 훨씬 빠르니 적용할만하다고 생각한다.
본디, 과거에는 SSD 수명이 매우 짧다보니 스왑으로 활용할 경우 SSD 수명이 가파르게 깎이는 문제점이 존재했으나, [JEDEC Standards](https://www.jedec.org/standards-documents/focus/flash/solid-state-drives) 를 참고하면 요즘날 SSD에는 크게 걱정할 요소는 아님으로 보인다.

# STEP 2. 본론

과거의 사례를 들어서 이야기를 해보았다. 스왑 영역을 사용하는 케이스는 아래와 같다고 정리를 할 수 있다.

+ 가용한 물리적 메모리와 어플리케이션의 사용량에 따라 스왑을 적절하게 설정할 수 있다. 
	+ 만약, 필요가 없다 가정하면 아예 설정을 하지않을 수 있다.
+ 스왑 영역을 세팅한다면 실제 RAM을 초과해도 속도는 느려지겠지만 시스템 다운은 막을 수 있다.

이 두가지 결론으로 인하여 스왑은 메모리보다 속도는 느리긴 하나 가용 메모리가 없을 경우 최악의 사태는 방지할 수 있다는 점을 알 수 있다. 

그렇다면 이제 본격적으로 `vm.swappiness = 1`로 설정하는 이유에 대해서 설명을 해보고자한다.
두 부분을 살펴봐야하는데 먼저 **운영체제 레벨**을 살펴본 후에 **JVM 레벨**을 살펴보는 식으로 글을 서술하고자한다. 

먼저, 운영체제의 캐시 관련하여 이야기가 필요하므로 이 이야기부터 진행해보고자 한다.

## STEP 2.1 운영체제의 캐시 영역과 스와핑

### STEP 2.1.1 캐시영역

OS 커널은 블록 디바이스(Block Devices)[^1] 라는 값을 통해서 디스크로 부터 데이터를 읽거나 쓴다. 하지만 당연히 이 비용은 디스크를 통하다보니 비쌀 수 밖에 없다.

그래서, 커널은 메모리의 일부에 캐시영역[^2]을 두어 한 번 읽은 디스크의 내용을 메모리에 저장해두어 동일한 내용을 읽고자하면, 디스크에 읽기 요청을 하는 것이 아니라 캐시 영역에 값이 존재하는지 확인한 후에 가져온다. 

<p align="center">
    <img src="https://i.imgur.com/cx5KQtU.png">
</p>
<p align="center">
    <em>그림 2. 캐시영역 적재 흐름도</a></em>
</p>


그림으로 보면 위와 같다고 볼 수 있다.
실제 어플리케이션 로드 상황에서 메모리 영역 사용 현황을 보면 아래와 같이 이뤄질 것 이다.

<p align="center">
    <img src="https://i.imgur.com/ddqF2a0.png">
</p>
<p align="center">
    <em>그림 3. 어플리케이션 로드 이후의 가용 메모리 변화</a></em>
</p>


1. 초기에 사용중인 메모리 영역과 가용 메모리 영역이 존재 
2. 시간이 흐름에 따라 캐시영역에 데이터가 적재
3. 어플리케이션에서 사용하게 되는 영역이 점점 많아짐 
4. 사용 중인 메모리 영역이 점점 커지면 캐시 영역에서 사용되던 일부를 어플리케이션이 사용하도록 변경 

이 과정 속에서 더 이상 가용 메모리가 충분하지않을 수 있는데 이때 스왑 영역이 존재하면 스왑을 사용하게 된다. 

그렇다면 이 스왑을 사용하는 과정은 어떻게 진행될까?

### STEP 2.1.2 스와핑


<p align="center">
    <img src="https://i.imgur.com/8BNaTLn.png">
</p>
<p align="center">
    <em>그림 4. 스와핑 동작 방식</a></em>
</p>


OS 레벨에서의 스와핑은 위와 같이 동작을 한다.

그러나, 위 그림을 보고 의아할 수도 있다.

> 왜 프로세스가 디스크 영역에 적재되나요?

그림 4는 기본적인 OS의 스와핑(Swapping)방식이다. 하지만, 가상 메모리(스왑 영역)는 **프로세스 단위로 스와핑을 하는 것이 아니라 페이지 단위로 스와핑**한다.

그림 2에 나와있는 캐시 영역은 사실 페이지 캐시(Page Cache)[^3] 를 통해서 관리되는데, 이는 후술할 내용이므로 그냥 단순하게 **캐시 영역에서 스왑 영역으로 이동되는 스와핑은 데이터가 디스크에 적재**된다고 보면 될 것 같다. 

이 부분에 대해서 좀 더 깊게 알고 싶다면 아래의 링크를 참고하자. 
+ [운영체제(OS) 스와핑(swapping), 가상메모리(virtual memory) 란? - 빠르고 꾸준하게](https://resilient-923.tistory.com/397)

그림 4에서 보는 것과 같이 스와핑에는 2가지 동작이 존재한다.
+ **스왑-아웃(swap-out)** : 메모리의 데이터 중 자주 사용되지 않은 데이터를 스왑영역으로 이동
+ **스왑-인(swap-in)** : 스왑으로 옮겨진 데이터를 다시 읽기 위해 데이터를 디스크에서 가져옴

서론에서 얘기했듯이 **Disk I/O 비용은 비싸다.**

그리고 가장 큰 문제는 우리는 그림3과 같이 **점점 어플리케이션이 사용량이 증가함에 따라 가용영역이 부족할 경우만 스와핑이 이뤄질 것으로 기대하지만 실제 동작은 그렇지 않다**는 점이다.

> 즉, 캐시영역이나 가용영역이 널널해도 스와핑이 발생할 수 있다.

이 부분을 이해하기 위해서는 운영체제의 메모리 재할당 방식에 대해서 이해해야한다.

### STEP 2.1.3 운영체제의 메모리 재할당 방식 

**리눅스 커널은 메모리가 유휴 상태(idle state)로 남아있는 것을 선호하지 않는다.** 이 과정을 나타낸 것이 바로 그림 3이라 보면될 것이다. 커널은 캐시 영역을 활용하는 식으로 하여 유휴 상태로 만들지 않는데, 이런식으로 운영되다보니 가용 메모리가 계속 줄게 된다. 이 때 **사용하지 않는 메모리를 확인하여 필요하는 곳에 재할당 하는 것을 메모리 재할당**이라 한다.

그림 3의 4번째 단계를 보면 캐시 영역이 줄어들고 사용하는 메모리 영역이 증가된 것을 볼 수가 있는데 메**모리 재할당 과정에서 주로 캐시 영역을 반환하고, 스와핑도 발생**하게 된다. 

**즉, 가용 메모리 영역이 없다면 사용 중인 메모리 중에 반환 할 수 있는 메모리가 있는지 찾아서 반환하게 된다.**

이때 바로 `vm.swappiness` 커널 파라미터가 사용되게 된다.

<p align="center">
    <img src="https://i.imgur.com/AMImeT5.png">
</p>
<p align="center">
    <em>그림 5. 메모리 재할당 방식</a></em>
</p>

설명했던 메모리 재할당 과정을 간략하게 표현한 것이 그림 5라고 보면 될 것이다.

스와핑을 다루면서 캐시 영역이나 가용 메모리 영역이 널널한데 스와핑이 발생할 수 있다고 말했었는데 그 이유가 바로 `vm.swappiness` 값에 따라 동작 방식이 다르기 때문이다.

저 커널 파라미터는 커널이 **얼마나 공격적으로 메모리 영역을 스왑 영역으로 옮기느냐를 결정하는 파라미터**이다. 따라서 이 값이 높아지면 캐시 영역이 여유가 있음에도 불구하고 스왑 영역을 사용하게된다. 따라서, 불필요한 스와핑이 발생하고 Disk I/O가 발생하므로 성능에 영향을 끼치는 것이다. 

따라서, 처리량이 높은 어플리케이션에서 `vm.swappiness = 1`로 설정하는 이유는 **메모리 재할당 과정 속에서 불필요한 스와핑을 줄이고, 가능한 캐시영역을 비우고 스왑을 사용**하고자 함이다.

이 비율을 계산하는 공식인 Swap Tendency도 존재한다. 

```
swap_tendency = mapped_ratio/2 + distress + vm_swappiness;
```

이 부분은 범위를 벗어나는 부분으로 재할당 부분과 해당 파라미터 등을 자세히 알고 싶다면 아래의 링크를 참고하자.
+ [메모리 재할당과 커널 파라미터 - 강진우님](https://brunch.co.kr/@alden/14)

참고로 0이 아닌 1로 설정하는 이유도 위 저자분께서 친절하게 작성해두셨다. 

> 다만 1로 설정했을 때보다 훨씬 더 많은 page cache를 해제하게 됩니다. 
> 거의 한자리 수까지 털어 버리기 때문에 좀 더 안정적인 성능의 시스템을 원한다면 1로 세팅해서 사용하는 것도 좋을 것이라 생각됩니다.
>
> page cache를 지나치게 버리면 I/O가 높아지고 시스템의 load를 상승시킬 수 있기  때문입니다. 

여기서 추가적으로 페이지 캐시를 다 버리는데 왜 I/O가 높아지는지에 대해서는 JVM 레벨에서의 내용을 다루면서 서술하고자한다. 

## STEP 2.2 자바, 페이지 캐시 그리고 가비지 컬렉션

위에서는 운영체제 레벨에서 해당 내용을 다뤘다 물론, 저기서 끝내도 무방하지만 필자는 `vm.swappniess` 값과 JVM과는 상관관계가 있는지 궁금했다. 

왜냐면, Kafka와 ES 모두 JVM 위에서 동작하는 녀석들이기 때문이다.

사실 이 부분도 JVM 내부를 분석한다던가 그런 내용은 아니다. 위의 기저지식을 기반으로 좀 더 세부적인 내용을 다루고, 실질적으로 어떤 영향을 끼치는지 서술할 예정이다.

그 전에 우리는 먼저 페이지 캐시에 알 필요가 있다.

### STEP 2.2.1 페이지 캐시와 더티 페이지 동기화 

사실, 그림 2에서 봤던 캐시 영역과 그림 5에서 봤던 캐시 영역 모두 페이지 캐시와 동치된다고 봐도 무방하다. 

우리는 위에서 **페이지 캐시를 통해서 한번 읽은 데이터를 적재해두고 Disk I/O를 줄이는 방식**으로 운영체제가 동작함을 알게되었다. 

그러면 아래와 같은 궁금증이 생기는 분도 계실 것이다. 

> 만약, 페이지 캐시에 적재된 페이지 중에서 변경이 발생하면 어떻게 되나요?

현재 이 글을 읽는 분들 중에서 JPA를 사용하시는 분이라면 더티 체킹(Dirty Checking)[^4]라는 용어를 들어보셨을 것이다. 

<p align="center">
    <img src="https://i.imgur.com/JsiNr2f.png">
</p>
<p align="center">
    <em>그림 6. 더티체킹, 자바 ORM 표준 JPA 프로그래밍, 김영한 저</em>
</p>


간략하게 위 그림을 설명하면, 1차 캐시를 페이지 캐시라 생각하고, 기존에 적재된 내역의 상태를 스냅샷으로 볼 수 있을 것이다. 이 후 엔티티 매니저를 통해서 스냅샷을 비교하여 업데이트를 수행한다. 

사실 이러한 동작방식은 운영체제 레벨에서도 비슷하다. 운영체제에서는 기존 페이지 캐시에 적재된 데이터인데 변경이 이뤄진 페이지를 더티 페이지(Dirty Page)[^5]라 부른다.

식별 방식과 처리 방식은 아래의 그림과 같다.

<p align="center">
    <img src="https://i.imgur.com/2IXA7Yc.png">
</p>
<p align="center">
    <em>그림 7. 더티 페이지 감지 및 동기화 방식</em>
</p>

1. A, B, C라는 데이터가 페이지 캐시에 있고, 이 값들은 디스크에 이미 적재되었다고 가정한다.
2. 페이지 캐시의 데이터 중 B -> D로 변경되었는데 이때 바로 디스크에 반영하지는 않고, 페이지 캐시에는 더티페이지를 들고있는다. 
3. 특정 조건이 채워졌을 경우에 더티페이지를 디스크에 반영한다. 

위의 방식으로 처리된다고 볼 수 있다. 
여기서 페이지 캐시에서 발생된 **더티페이지를 디스크에 쓰는 행위를 더티 페이지 동기화**라 한다.

그러면 우리는 아래와 같은 가정을 가질 수 있다.
+ 만약, 동기화 특정 조건을 매우 짧게 가져간다면? -> 더티페이지 생성마다 빈번하게 Disk I/O 발생
+ 만약, 동기화 특정 조건을 매우 길게 가져간다면? -> 더티페이지가 페이지캐시에 적재되는데 서버다운 시 이 데이터들은 모두 휘발 

역시 **은총알은 없다.(No Silver Bullet)** 하지만 우리는 처리량이 높은 JVM 어플리케이션을 기준으로 설명하고 있다보니 Disk I/O를 줄이는게 좀 더 초점이 될 수 있을 것이다.

동기화의 발생 횟수 등 조건을 제어하는 커널 파라미터는 아래와 같다. 

```
vm.dirty_backgroud_ratio 
vm.dirty_ratio 
... etc ...
```

이 부분에 대해서 좀 더 깊게 보고 싶으면 아래의 링크를 참고해보자. 
+ [dirty page 동기화 #1 - 강진우님](https://brunch.co.kr/@alden/32)


### STEP 2.2.2 자바 메모리와 가비지 컬렉션

사실 이전의 내용들을 이 내용을 위한 빌드업이라고 볼 수 있다. 이제는 Kafka와 ES의 사례를 들어서 위의 내용들을 종합하고자 한다.

우선, 자바 개발자면 이런 생각을 갖을 수 있다. 

> 그러면 스왑이든 페이지 캐시든 사용하기 번거로우니 자바에서 인-메모리로 관리하면 안되나요? 어차피 GC가 알아서 해주지 않나요? ㄹㅇㅋㅋ 

그러나, Kafka와 ES 모두 운영체제의 페이지 캐시를 활용하는데 도대체 그 이유가 무엇일까? 
이 해답은 [Kafka 공식 문서](https://docs.confluent.io/kafka/design/file-system-constant-time.html#ak-and-the-jvm)에 나와있다.

>  Kafka is built on top of the JVM, and Java memory usage has the following characteristics:
>  1. The memory overhead of objects is very high, often doubling the size of the data stored (or worse).
>  2. Java garbage collection becomes increasingly slow as the in-heap data increases.

즉, 위 2가지 특성때문에 자바 메모리로 관리하는 캐시보다 운영체제의 페이지 캐시를 사용하게 디자인되었다고 보면된다. 그리고 이러한 디자인의 가장 큰 장점은 바로 **GC의 패널티**를 줄일 수 있다는 점이다. 

어찌됐든 STW(Stop-the-world)는 GC하는 순간에 발생한다. 만약, 대량의 데이터가 메모리에 올라가진 상태에서 GC가 발생한다면? 그게 Full-GC라면? STW로 어플리케이션이 멈추는 시간은 매우 길어질 것이다. 

다른 장점으로는 어플리케이션 재시작 상황을 가정해보자 우리가 만약 캐시를 자바 메모리로 관리하고 있었다면 재시작하는 순간 캐시들이 전부 휘발될테고 이 캐시를 웜업하기 위해서 다시 상당한 시간이 소요될 것이다.

하지만, 운영체제의 페이지 캐시로 관리하면 어플리케이션의 동작유무와 별개로 캐시는 존재할 것이므로 다시 웜업하는 비용이 단축될 것이다. 

이것과 관련된 재미난 이슈를 아래의 링크에서 확인할 수 있다.
+ [Java process takes a long time with -XX:+AlwaysPreTouch - Red Hat Customer Portal](https://access.redhat.com/solutions/2685771)

간단하게 설명하면 `-XX:+AlwaysPreTouch` 옵션은 Heap 사이즈가 큰 경우에 공간을 0으로 채워 초기화하는데 부팅 속도는 느려지지만 실행시 속도는 빨라진다는 이점이 있다. 즉, **웜업 비용이 단축**되는 명령어라고 보면될 것같다. 

해당 옵션을 사용하면 Xmx 설정한 힙사이즈(최대 힙사이즈)를 모두 0으로 터치한다. 이 케이스에서 원래 우리가 그림 3에서 봤던 거처럼 점진적으로 페이지 캐시가 할당되는게 어플리케이션 시작점부터 운영체제에 페이지를 요청한다.

그러면 가용 메모리 영역에서 페이지를 요청하기 위해서 메모리 재할당 과정이 이뤄질 것이다. 

그 뒤를 생각해보자. 운영체제에 메모리를 요청해서 페이지가 생겼는데 동작과정 속에서 이미 페이지가 생겼으니 데이터가 변경될때마다 더티페이지가 생길 것이다. 

자 이때 가용 메모리가 부족하여 재할당 과정이 발생한다고 가정해보자. 그러면 이미 많은 양의 페이지 캐시가 생성되어있으므로 그만큼 재할당을 하는 과정이 느려질 것이고, 더티페이지 커널 파라미터도 별도 튜닝을 안했다면 Disk I/O도 많이 발생할 것이다. 

해당 이슈는 위와 같은 이유때문에 느려진 것이 않을까? 추론할 수 있을 것이다.

자 이제, JVM 상에서 동작하는 어플리케이션들 중에서 처리량이 높아야하는 요구사항을 지닌 것들은 운영체제의 페이지 캐시를 사용하는 것을 이해할 수 있었다. 이유는 자바 메모리의 특성과 연관이 되어있었다. 

그러면, 왜 스왑은 쓰면 안될까? 이 내용은 사실 GC와 관련이 있다.
아래와 같은 상황이라 가정해보자. 

<p align="center">
    <img src="https://i.imgur.com/MZw7rIs.png">
</p>
<p align="center">
    <em>그림 8. 자바 힙 내에서 레퍼런스가 끊겼지만 회수는 안된 상황</em>
</p>

1. B, A, C라는 데이터가 할당 된 후에 페이지 캐시에 적재가 되었다.
2. B, A, C라는 데이터가 더이상 자바 어플리케이션에서 사용되지 않으나 아직 GC에 의해 수거되기 전이다.

자 우리는 위에서 스왑-아웃과 스왑-인에 대해서 배웠다. 페이지 캐시에 적재된 페이지가 자주 사용되지 않으면 스왑 영역으로 이동된다는 점 말이다.

그러면 아래와 같이 예상할 수 있다.

<p align="center">
    <img src="https://i.imgur.com/LeJbSEA.png">
</p>
<p align="center">
    <em>그림 9. 운영체제가 먼저 스왑 아웃을 하여 실제 GC 발생 시 Disk I/O가 발생하는 상황</em>
</p>


스왑-아웃을 통해서 스왑 영역으로 이동한 페이지가 실제 JVM이 GC를 트리거하게되면 이 내용을 찾기 위해서 다시 스왑-인을 해야될 것이다.

즉, **STW가 매우 길게 발생**할 수 있다.이 점이 스왑영역을 JVM 어플리케이션이 최소화시키는 이유라 볼 수 있다. 


# STEP 3. 결론 

어쩌다보니 긴 글이 되었는데 정리를 하자면 아래와 같다. 

1. 가상 메모리를 통한 Disk I/O는 SSD, NVMe를 사용해도 RAM과 비교해서 여전히 느리다.
2. 1에 의거해서 운영체제의 페이지 캐시를 스와핑하는 작업은 비용이 상당히 높은 작업이다.

하지만 그럼에도 처리량이 높아야하는 요구사항을 갖는 자바 어플리케이션은 페이지 캐시를 사용한다. 그 이유는 아래와 같다.

1. 자바 메모리의 GC 패널티가 매우 크다.
2. 자바 어플리케이션 재시작 시 데이터 유실 문제 및 웜업 작업등의 추가 작업이 필요하다. 

그럼에도 스와핑은 Disk I/O와 GC를 사용할 적에 문제점이 생길 수 있으니 사용하더라도 최소화해서 쓰는 방식이 선호되고 있다. 

긴 글 읽느라 다들 고생 많으셨습니다.

## STEP 3.1 추신 

이 내용을 정리한 계기가 되었던 부분은 아래의 글 때문입니다.
+ [Just say no to swapping! - Michael McCandless](https://blog.mikemccandless.com/2011/04/just-say-no-to-swapping.html)

근데, 해당 글이 작성년도는 2011년으로 확인됩니다. (Java 7 사용 시점쯤에 작성된 글)
그러나, 결론 부에 제가 그린 그림은 G1GC의 Region과 같이 구성되어있습니다.

이 부분에 대해서 제가 실제 검증은 하지 않았지만, 현재까지도 위와 같이 발생할 수 있는 문제가 있지않을까? 추론해서 그린 그림입니다. 그러면 해당 추론이 합리적일까요?

1. [Memory and JVM Tuning - GridGain Doc](https://www.gridgain.com/docs/latest/perf-troubleshooting-guide/memory-tuning#tune-swappiness-setting)

위 가이드에서는 아래와 같이 작성되어있습니다.

> The value of this setting can prolong GC pauses as well. 
> For instance, if your GC logs show low user time, high system time, long GC pause records, it might be caused by Java heap pages being swapped in and out. To address this, use the swappiness settings above.

따라서, 실제 GC 시간이 스왑-인/아웃으로 느려질 수 있다는 점을 시사한다고 봅니다.

2. [Design of Swap-aware Java Virtual Mache Garbage Collector Policy](https://www.slideshare.net/HyojeongLee6/paperdesign-of-swapaware-java-virtual-machine-garbage-collector-policy)

위 링크는 JVM GC 중에 발생하는 시스템 스왑의 영향도와 그것에 대한 해결법에 대한 논문의 요약 슬라이드입니다.

논문 자체를 보진 않아서 슬라이드만 참고하면 G1GC는 아니고 Parallel GC(Mark-and-Summary Compaction이 슬라이드 뒷편에 기술되어있어서) 기준인거 같긴합니다. 어찌됐든 GC와 스왑영역에 대해서 확실한 영향도가 있음을 시사하고 있습니다.

3. [Tuning Java application on Linux](https://www.mastertheboss.com/java/tuning-java-applications-on-linux/)

해당 링크에서는 자바 어플리케이션이 현재 스왑을 사용하는지 확인할 수 있는 스크립트를 제공해주고, 병목지점으로 스왑이 식별될 시 대처법을 설명하고 있습니다.

위 같은 다양한 사례를 보면 G1GC에도 충분히 적용될 사례로 보이는데 시간이 난다면 해당 내용에 대한 검증을 추가해보겠습니다.

# STEP 4. 참고자료 

1. [If you have a super fast NVMe M.2 SSD for virtual memory (caching, or swap files), do you still need a lot of physical RAM?](https://www.quora.com/If-you-have-a-super-fast-NVMe-M-2-SSD-for-virtual-memory-caching-or-swap-files-do-you-still-need-a-lot-of-physical-RAM)
2. [Why are swap partitions discouraged on SSD drives, are they harmful?](https://askubuntu.com/questions/652337/why-are-swap-partitions-discouraged-on-ssd-drives-are-they-harmful)
3. [Ubuntu Linux Hibernation](https://kwonnam.pe.kr/wiki/linux/ubuntu/hibernation)
4. [운영체제(OS) 스와핑(swapping), 가상메모리(virtual memory) 란? - 빠르고 꾸준하게](https://resilient-923.tistory.com/397)
5. [메모리 재할당과 커널 파라미터 - 강진우님](https://brunch.co.kr/@alden/14)
6. [Just say no to swapping! - Michael McCandless](https://blog.mikemccandless.com/2011/04/just-say-no-to-swapping.html)
7. [Elasticsearch 캐싱 심층 분석 : 한 번에 하나의 캐시로 쿼리 속도 향상 - elastic.co](https://www.elastic.co/kr/blog/elasticsearch-caching-deep-dive-boosting-query-speed-one-cache-at-a-time)
8. [dirty page 동기화 #1 - 강진우님](https://brunch.co.kr/@alden/32)
9. [Memory and JVM Tuning - GridGain Doc](https://www.gridgain.com/docs/latest/perf-troubleshooting-guide/memory-tuning#tune-swappiness-setting)
10. [Design of Swap-aware Java Virtual Mache Garbage Collector Policy](https://www.slideshare.net/HyojeongLee6/paperdesign-of-swapaware-java-virtual-machine-garbage-collector-policy)
11. [Tuning Java application on Linux](https://www.mastertheboss.com/java/tuning-java-applications-on-linux/)

[^1]: [Block Devices - Wikipedia](https://en.wikipedia.org/wiki/Device_file#Block_devices)
[^2]: [Disk cache - Wikipedia](https://en.wikipedia.org/wiki/Disk_cache)
[^3]: [Page cache - Wikipedia](https://en.wikipedia.org/wiki/Page_cache)
[^4]: [더티 체킹(Dirty Checking)이란? - 기억보단 기록을](https://jojoldu.tistory.com/415)
[^5]: [What are dirty pages? - lemp.io](https://lemp.io/what-is-a-dirty-page-in-operating-system/)

