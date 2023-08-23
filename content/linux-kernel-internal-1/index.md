---
title: "[Kernel] 리눅스 스케줄링 매커니즘과 Load Average"
date: 2023-08-23 21:55:00 +0900
tags:
  - Linux
  - Core
emoji: 💻
author: 개발한입
categories: 개발 인프라 독서요약
---

```toc
```

# 개요 

최근에 커널 책을 같이 읽고 정리하는 스터디를 시작하였다. 이를 다루기 앞서, 난이도가 조금 있다보니 배경지식이 조금 필요한 것으로 보인다. 
이에 따라, 중요한 개념 몇가지만 짚고 이와 연관된 내용으로 같이 얘기를 해보고자 한다. 

## 1. 서론 

### 1.1 병렬성과 동시성 

![](https://i.imgur.com/KW1ffSd.png)

1. 병렬성(Parallelism)
	+ 물리적 쓰레드에 연관이 있으며, 코어 당 만약 1개의 쓰레드를 가지게 되면 4개의 물리적 쓰레드를 갖게 된다.
	+ 이 물리적 쓰레드는 실제로 분리된 코어 상에서 동작하므로 동시에 수행될 수 있다. 


![](https://i.imgur.com/vyDaj7R.png)

위와 같이 태스크들이 4개로 병렬 수행을 한다해도 문제 없이 동작을 할 수 있다. 이것이 병렬성이다. 

2. 동시성(Concurrency) 
	+ 프로세스 혹은 프로그램 상에서 생성한 논리적 쓰레드에 연관이 있다
	+ 실제로 동시 수행은 일어나지 않으나 시분할적으로 매우 빠르게 문맥교환이 일어나서 하나의 흐름처럼 동시에 보이는 것이다.

![](https://i.imgur.com/YuGifc5.png)


위의 그림에서 Process에 2개의 논리적 쓰레드가 있었는데 해당 쓰레드 2개가 어떠한 작업($T1, T2$)를 처리하는 상황을 그려본 것이다. 

참고 : https://freecontent.manning.com/concurrency-vs-parallelism/

그렇다면, 이 병렬성과 동시성의 개념이 왜 중요할까? 

밑에서 Run Queue와 Wait Queue를 다루면서 컨텍스트 스위칭에 대한 내용을 다룰 것인데 이 개념을 이해하기 위해서 중요하다고 보면 된다.

### 1.2 Run Queue와 Wait Queue

```c
/* Used in tsk->state: */
#define TASK_RUNNING			0x00000000
#define TASK_INTERRUPTIBLE		0x00000001
#define TASK_UNINTERRUPTIBLE		0x00000002
#define __TASK_STOPPED			0x00000004
#define __TASK_TRACED			0x00000008
```
+ 출처 : https://github.com/torvalds/linux/blob/master/include/linux/sched.h#L86

위는 리눅스에서 작업(Task)의 상태를 나타내는 식별자이다. 

| 상태                   | 설명                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------ | 
| `TASK_RUNNING`         | 작업 실행 가능 상태를 나타내며, 현재 실행 중이거나 실행 대기열(`Run Queue`)에서 대기중     | 
| `TASK_INTERRUPTIBLE`   | 작업이 어떤 상황이 발생하는 동안 잠을 자는 상황, 신호가 수신되면 일찍 잠에서 깨울 수 있다. |  
| `TASK_UNINTERRUPTIBLE` | 작업이 어떤 상황이 발생하는 동안 잠을 자는 상황, 조기에 깨울 수 없다.                      | 

이 큰 맥락말고도 실제 동작 유무에 따라서 아래와 같이 상태를 나타낼 수 있다.
1. `running` : `TASK_RUNNING` 상태이며, 현재 동작중인 작업 
2. `runnable` : `TASK_RUNNING` 상태이며, `Run Queue`에 인입되어 실행되기를 기다리는 작업
3. `blocked` : `TASK_INTERRUPTIBLE` 혹은 `TASK_UNINTERRUPTIBLE` 인 작업 상태 

이제 실제 `Run Queue`의 구조를 보자. 

#### 1.2.1 Run Queue

![](https://i.imgur.com/qW8dVbK.png)

위와 같은 `task_struct`의  `list_head` 포인터를 통해서 자식/형제 계층들이 연결이 된다. 
`run queue`는 상태가 `TASK_RUNNING`인 `list_head` 들과 연결이 된다. 따라서, `run queue` 용으로 `task_struct`에는 별도로 `list_head`가 있어야한다.

`run queue`는 코어당 존재를 하며, 4코어일 경우에는 각 코어마다 1개씩 존재하여 4개의 `run queue`가 존재하게 된다.

그러나 주의할 점은 아래의 내용이다.
+ `run queue` 에 위치하는 부모/자식 작업은 동일한 CPU에서 실행되지 않을 수 있다.
	+ Core1에 위치하던 $T1$이 Core2에서도 수행가능 (OS 스케줄러에 의한 로드밸런싱에 의거)
	+ 그러나, CPU 선호도(CPU Affinity)나 캐시 워밍업때문에 같은 작업이 같은 코어에서 작업되는 것이 선호된다. 
+ `run queue`에 위치하는 부모/자식 작업은 모두 실행 중일 필요는 없다. 

이것이 어떻게 보면 병렬성이 보장되는 이유기도 하다. (각 코어마다 `run queue`가 존재하기에 이상적으로 4개의 작업이 4개의 코어의 `run queue`가 비워져있다면, 동시수행 가능)

참고 : https://github.com/torvalds/linux/blob/master/kernel/sched/sched.h#L957-L1030

#### 1.2.2 Wait Queue

![](https://i.imgur.com/VZzy5ob.png)

`Wait Queue`는 `Run Queue`와 `TASK_INTERRUPTIBLE` 혹은 `TASK_UNINTERRUPTIBLE` 상태를 가진 작업과 연결이 된다. 

참고 : https://github.com/torvalds/linux/blob/master/include/linux/wait.h#L30-L43

이 과정에 대한 이벤트 루프 방식은 아래와 같다.

1. `prepare_to_wait()` : `TASK_INTERRUPTIBLE`로 변경 후 `Wait Queue`에 작업을 인입시킨다.
2. `signal_pending(state)` : 작업에 시그널이 전달됐으면 `true` 아니면 `false` 를 리턴시킨다. 
	+ 잠들기 전에 시그널을 받았으면 잠드는 대신에 루프를 탈출한다. 
3. `schedule()` : 실제로 잠들기를 수행한다. 
4. `finish_wait()` : `TASK_RUNNING` 상태로 변경한 후에 해당 작업을 `Wait Queue`에서 제거한다.

이러한 이벤트 루프가 존재하며, 1-4를 계속 반복한다고 보면 된다. 

## 리눅스 내에서 기본적인 스케줄링 

먼저, [linux/kernel/sched/core.c](https://github.com/torvalds/linux/blob/master/kernel/sched/core.c#L6591-L6718) 쪽을 보면 `schedule()` 이라는 함수가 있음을 확인할 수 있다.

이 함수 내부적으로는 아래의 함수들도 사용된다.
1. `pick_next_task()` : run queue에서 꺼내서 실행시킬 새 작업을 선택하는 함수
2. `context_switch()` : 현재 작업을 휴면상태로 변경 후 위 함수에서 가져온 작업을 실행 시키는 함수 

이를 토대로, Wait Queue에 대한 스케줄링은 아래와 같이 나눠진다.

+ 휴면상태 돌입 
	1. [wait_event()](https://github.com/torvalds/linux/blob/master/include/linux/wait.h#L300-L322)함수 호출 
	2. [Wait Queue에 작업을 적재](https://github.com/torvalds/linux/blob/master/kernel/sched/wait.c#L305-L339)
	3. [schedule()](https://github.com/torvalds/linux/blob/master/kernel/sched/core.c#L6591-L6718) 함수 호출
	4. Run Queue에 해당 작업 제거
	5. [pick_next_task()](https://github.com/torvalds/linux/blob/master/kernel/sched/core.c#L6674C9-L6674C23) 함수 호출 
	6. [context_switch()](https://github.com/torvalds/linux/blob/master/kernel/sched/core.c#L6710C8-L6710C22) 함수 호출 
	7. 다른 작업 수행 

+ 휴면상태를 깨우기 
	1. [wake_up()](https://github.com/torvalds/linux/blob/master/kernel/sched/wait.c#L80-L121)함수 호출
	2. 각 작업마다 [try_to_wake_up()](https://github.com/torvalds/linux/blob/master/kernel/sched/core.c#L4197-L4354) 함수 호출
	3. 각 작업을 Run Queue에 적재
	4. `schedule()` 함수를 호출하고 이전에 잠들었던 태스크가 선택된다. 
		+ 조건이 `false`면 : 계속 휴면상태에 있음
		+ 조건이 `true`면 : 휴면상태를 끝내고, [finish_wait()](https://github.com/torvalds/linux/blob/master/include/linux/wait.h#L320C2-L320C13) 함수를 호출하여 Wait Queue에 작업을 제거 

### 1.3 프로세스 상태 변화 

![](https://i.imgur.com/8492Pvm.png)

위 상태에서 `read()`라는 시스템콜이 유저모드에서 발생할 시 아래와 같이 처리가 된다. 

1. 커널에 트랩이 발생
	+ 각 프로세스에 대한 레지스터를 커널 스택에 저장
2. 디바이스 드라이버(DMA와 같은)가 I/O Request(IRQ)를 디바이스에 발행
3. 호출되는 프로세스를 휴면상태로 변화 
	+ `wait_event()` -> `schedule()` -> `pick_next_task()` -> `context_switch()`
4. 다른 프로세스를 수행(문맥교환이 발생하였기 때문에)
5. 디바이스에서 IRQ를 성공적으로 처리하였으면, 하드웨어 인터럽트 발생
6. 커널에 트랩을 발생시킨 후, 인터럽트 핸들러로 PC를 이동
	+ `wake_up()` : 현재 블록킹 중인 작업을 Run Queue로 적재
	+ 현재 태스크는 결과적으로 `schedule()` -> `pick_next_task()` -> `context_switch()`의 과정을 호출함.
7. 다른 프로세스를 수행 
	+ 여기서, 휴면상태에서 다시 동작하게끔 변경이 되었다면 이 프로세스는 `read()` 함수를 호출한 프로세스일 수도 있으며 아닐 경우 다른 프로세스일 수 있다. 

## 가상 주소 공간

C나 CPP같은 언어를 써서 `malloc()` 같은 시스템 메모리(Physical Memory)를 요구하는 함수를 호출한다 가정했을 때, 우리는 뭔가 `malloc()`을 호출하면 당연하게도 어떠한 시스템 메모리에 영역을 할당받는다고 생각했을 것이다.

하지만, 리눅스에서도 가상 메모리라는 개념을 활용한다. 이는 SWAP 영역과는 별개의 가상 메모리라고 보면 될 것같다. 

![](https://i.imgur.com/7uArXuJ.png)

> 위에서는 `malloc()` 호출 시 시스템 콜이 발생되는 가정으로 하였는데 실제로는 발생안하는 케이스도 있으니 참고하기 바란다.

실제로는 위와 같이 바인딩이 된다고 보면된다. 실제로 어플리케이션을 사용할 때는 물리적 메모리에 대해서 가상공간으로 변환해서 사용하는데, 이 가상공간으로 변환되어서 사용되는 물리적 메모리 공간을 가상메모리라고 뜻한다고 보면된다. (이 작업은 MMU에서 처리해준다.)

참고로, MMU나 가상 메모리를 사용하지 않는 시스템의 경우도 있다.

참고 : https://docs.kernel.org/admin-guide/mm/concepts.html

### 1.4 MMIO(Memory Mapped I/O)

MMIO는 위 가상메모리와 비슷하게, I/O 작업을 좀 더 빠르게 처리하기 위해서 사용하는 방식이다.

`malloc()` 이 아닌 `read()` 와 같은 시스템 콜을 활용하여 File I/O 처리가 필요하다고 가정해보자.
그렇다면, `lseek()` 과 같은 시스템 콜을 통해서 파일을 접근 한후 실제 `read()`를 통해서 내용을 커널에서 유저 모드의 버퍼로 전달해야될 것이다. 

이런 과정은 어떻게 보면 느리며, 복잡할 수 있다. 이에 대한 대안은 파일의 영역을 가상 주소 공간에 매핑시키는 것이다. 아래와 같이 말이다.

![](https://i.imgur.com/AfVhSnr.png)

매핑된 영역은 디스크에 의해 지원이 되는데 메모리 매핑된 영역에 대한 업데이트는 먼저 메모리로 가고, 후에 디스크로 플러시 된다고 보면된다. 

또한 이 매핑 영역은 두 가지 방식이 존재한다.
1. Private Mapping : 파일의 스냅샷을 제공 받지만 변경 사항은 디스크로 플러시가 되지 않으며, 동일한 영역을 매핑하는 다른 프로세스에게는 보이지 않는다.
2. Shared Mapping : 같은 메모리를 참조하며, 이런식으로 매핑된 데이터를 가진 프로세스는 서로의 업데이트를 확인할 수 있다.

실제 동작원리는 잘 쓰여진 포스팅이 있어서 이로 대체한다.
+ 참고 : https://pr0gr4m.tistory.com/entry/Linux-Kernel-5-mmap

위에서는 File에 대한 매핑에 대한 예시라면, 때때로 파일에 의해 백업되지 않은 메모리를 매핑할 수도 있으면 좋겠다라는 요구사항이 발생할 수 있다.(`malloc()` 과 같은)

이럴 때 사용하는 것이 익명 메모리 매핑이라고 보면된다. 

```c
#define LEGACY_MAP_MASK (MAP_SHARED \
		| MAP_PRIVATE \
		| MAP_FIXED \
		| MAP_ANONYMOUS \
		| MAP_DENYWRITE \
		| MAP_EXECUTABLE \
		| MAP_UNINITIALIZED \
		| MAP_GROWSDOWN \
		| MAP_LOCKED \
		| MAP_NORESERVE \
		| MAP_POPULATE \
		| MAP_NONBLOCK \
		| MAP_STACK \
		| MAP_HUGETLB \
		| MAP_32BIT \
		| MAP_HUGE_2MB \
		| MAP_HUGE_1GB)
```

위는 [mman.h](https://github.com/torvalds/linux/blob/master/include/linux/mman.h)에 대한 코드 중에서 매모리 매핑에 관련된 마스크에 대한 내용을 담고 있다.
이때, 익명 메모리 매핑을 사용하기 위해서는 `MAP_ANONYMOUS` 를 둬서 처리하면 된다.

이때도 마찬가지로 매핑을 공유할 지 안할 지 처리할 수 있는데 이 구조에 따라서 `fork()` 와 같은 시스템콜에 영향을 끼친다.

`MAP_PRIVATE` : `fork()` 와 같은 시스템콜로 생성된 자식 프로세스는 독립적인 복사본을 얻게된다. (`malloc()`과 같은)

`MAP_SHARED` : 자식 프로세스는 메모리 매핑을 공유하며, 서로의 업데이트를 볼 수 있다. 이렇게 될 경우 IPC 형태라 볼 수 있는데 이 방식으로 생성된 자식 프로세스는 `pipe()`와 같이 사용된다. 비슷한 IPC 형태는 공유 메모리에 의한 IPC라 보면될 것이다.

참고 : http://csl.snu.ac.kr/courses/4190.307/2020-1/9-mmap.pdf

## 2. 본론

이제 본론으로 들어와보자.

사실 위 내용을 다뤘던 이유는 현재 스터디 중인 책과 관련이 있다.

![](https://i.imgur.com/Wr6OE3y.png)


현재, 이 책에 대한 스터디를 진행 중이었고, 1 ~ 3장을 각자 정리를 해오자라고 얘기가 나왔는데 보다 심층적으로 파악할 필요가 있어서 위와 같은 배경지식을 설명해보았다. 
이제 본격적으로 이 책에서 다뤘던 내용을 다뤄보고자한다.

초점은 2 ~ 3장과 관련된 내용이라고 보면될 것이다.

### 2.1 VIRT & RES & SHR

먼저, 리눅스의 top 명령어를 입력하게 되면 아래와 같은 화면을 볼 수 있다. 

![](https://i.imgur.com/WjZnsOx.png)

이 중에서 우리가 중점적으로 볼 지표는 `VIRT`, `RES`, `SHR` 이다.

![](https://i.imgur.com/sI9WtTX.png)

1. `VIRT` : `RES`와 `SHR` 그리고 SWAP영역까지 프로세스가 사용되는 메모리의 전체 용량
2. `RES` :  프로세스가 사용 중인 물리 메모리(Physical Memory)의 용량
3. `SHR` :  프로세스가 사용 중인 공유 메모리의 용량 

여기서 헷갈렸던 부분은 책에서는 `VIRT`에 대해서 가상메모리(Virtual Memory)의 전체 용량으로 얘기했어서 이것이 위에서 보았던 가상 주소 공간(Virtual Address Area)의 용량을 나타내는 것인지 아니면 실제 HDD나 SDD를 메모리처럼 활용하기 위한 가상메모리인 SWAP 영역을 나타내는지 궁금해졌다. 

찾아보니 `VIRT`가 나타내는 메모리 총 용량은 아래와 같이 계산된다.

$VIRT = RES + SWAP + SHR$

즉, 물리메모리, 공유메모리, 가상메모리(SWAP)에 대한 프로세스가 점유하고 있는 메모리 총 용량이라고 볼 수 있다.
따라서, `VIRT`를 통해서 어떤 프로세스가 스왑메모리를 많이 사용하는지도 파악이 가능할 수 있다.

왜냐면, 스왑메모리는 가상메모리의 일종이므로 $VIRT > TOTAL \; MEMORY$ 인 상황이면 스왑메모리를 사용하는 것을 추측할 수 있다. (`SHR` 의 크기는 그리 크지 않기 때문이다.)
이를 토대로 `SWAP` 을 최소화해서 사용해야하는 어플리케이션의 사용량을 추적할 수도 있어보인다.

어떤 케이스에 SWAP 영역을 최소화 해야되는지 궁금하다면 제 블로그의 아래의 아티클을 읽어보기를 추천한다.
+ https://brewagebear.github.io/fundamental-os-page-cache/

그리고 `VIRT`가 Virtual을 나타내는 것과 같이 보이는데 위에서 얘기했던 내용에 대해서 첨언하면, `VIRT`는 **가상 주소 공간에 대한 용량이 맞다**고 보면 된다.

> 💡즉, 가상 주소 공간에 메모리 할당을 할 때 SWAP에 처리되는 페이지 캐시나 기타 데이터도 이 영역에 할당이 되어지는 것이다. 
> 이 부분은 서론에서 얘기했듯이 MMU가 관리하고, 스왑-아웃을 통해서 스왑 영역으로 페이지가 이동되더라도 가상 주소 공간에서 할당이 일관되게 유지되는 것이다.

오해의 소지가 있어보이므로 앞으로 물리 메모리와 실제 매핑되서 MMU에 관리되는 부분을 가상 주소 공간, 보조기억장치와 메모리 영역 사이에서 관리되는 부분을 SWAP이라고 명시하도록 하겠다.

### 2.2 Memory Commit

자 그러면, 리눅스에서 왜 `VIRT`와 `SHR`를 따로 나눠서 관리를 할까? 
이는 메모리 커밋과 관련이 있다.

서론에서 얘기한 바와 같이 `malloc()` 등으로 메모리 할당을 요청하면 가상 주소 공간에 대한 주소를 넘겨준다. 

![](https://i.imgur.com/wXo9CGA.png)

하지만, 이때도 실제 물리 메모리에 해당 영역이 할당된 상태는 아니라는 것이다. 
예약은 해두고 가상 주소 공간에서 주소를 넘겨받는 이러한 동작 방식을 `Memory Commit` 이라 한다.

그러면 실제 물리 메모리에 언제 바인딩이 될까? 그것은 바로 직접적으로 쓰기 작업이 발생할 때이다.
쓰기 작업을 수행하면 페이지 부재(Page Fault)가 발생할 것이고 내부적인 매커니즘에 따라서 처리가 된다. 

```c
/*
*문제의 VMA(가상 메모리 영역)가 거대한 페이지(HugeTLB)에 의해 지원되는 경우 커널은 결함 처리를 `hugetlb_fault` 기능에 위임. 
* 이 기능은 크기 및 관리 방식으로 인해 일반 페이지와 다르게 처리되는 대형 페이지와 특히 관련된 오류를 처리.
*/
if (unlikely(is_vm_hugetlb_page(vma))) ret = hugetlb_fault(vma->vm_mm, vma, address, flags); 

/*
* 거대한 페이지 폴트가 아닌 경우 `__handle_mm_fault` 함수로 페이지 부재를 전달. 이 함수에는 표준 페이지 오류를 처리하는 기본 논리가 포함되어 있고, 여기에는 여러 작업이 포함될 수 있다.
* 1. 페이지가 이미 메모리에 있지만 프로세스의 페이지 테이블에 매핑되지 않았는지 확인(사소한 결함).
* 2. 이전에 교체된 경우(스와핑) 교체 공간(스왑 영역)에서 페이지를 로드.
* 3. 파일 기반 매핑인 경우 백업 저장소(예: 디스크의 파일)에서 페이지를 가져옴.
* 4. 이전에 기록되지 않은 익명 매핑인 경우 새로운 제로 페이지 할당.
*/
else ret = __handle_mm_fault(vma, address, flags);
```

참고 코드 1 : https://github.com/torvalds/linux/blob/master/arch/arm64/mm/fault.c#L500C1-L500C1
참고 코드 2 : https://github.com/torvalds/linux/blob/master/mm/memory.c#L5201
참고 코드 3 : https://github.com/torvalds/linux/blob/master/mm/page_alloc.c#L4594C5-L4594C5

즉, 새로 할당을 하는 케이스면 4번에 해당될 것이고 새로운 제로 페이지를 할당 받는 것이다.  
이렇게 바인딩된 값을 페이지 테이블(Page Table)이라 부르며, 물리 메모리에 실제 바인딩된 영역이 `RES`로 계산된다.

책에서도 나오지만 그렇다면 위 방식과 같이 처리할 경우 무제한으로 `malloc` 과 같은 시스템 콜을 사용할 수 있는가에 대해서 나온다.
이에 대한 짧은 코드도 제시해주는데 실제로 돌려보면 비슷한 결과를 얻을 수 있다.

```c
#include <unistd.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#define MEGABYTE 1024*1024

int main() {
	void *myblock = NULL; 
	int count = 0;

	while (1) {
		myblock = (void *) malloc(MEGABYTE); 
		if (!myblock) {
			printf(“Error!”);
			break; 
		}

		printf(“Currently allocating %d MB\n”, (++count)*MEGABYTE); 
		// memset(myblock, 1, MEGABYTE);
		sleep(1); 
	}

	exit(0); 
}
```

위 코드를 `gcc example1.c` 로 `a.out` 실행 파일을 얻어서 돌려본 결과를 아래와 같다. 

![](https://i.imgur.com/2A5yc1J.png)

보면 세번째 (6XXXX) 숫자가 `VIRT`고 1548 값이 `RES` 값이다.  `//memset(myblock, 1, MEGABYTE);` 이 주석처리 되어있어서 우리가 이론 상으로 배웠던 내용처럼 `RES`는 증가하지 않는 모습을 보여준다.
그렇다면 주석을 해제하고 돌려보면 어떻게 될까?

![](https://i.imgur.com/7lkKwqL.png)

3152였던 `RES` 값이 실제로 증가함을 확인할 수 있다. 동일한 값이 나오는 이유는 VM에 돌리는 환경이다보니 메모리가 한정적이라 `sleep(2)`로 둬서 2초의 간격이 생겨서 그런거라고 보면 된다.
자 이제 실제 메모리 쓰기 전까지는 `VIRT`만 증가하고, 실제 메모리가 쓰여질 때 물리 메모리인 `RES`를 할당받는다는 점을 알게되었다. 

그렇다면, `VIRT`는 무한정 늘어날 수 있을까? 그 부분에 관련된 커널 파라미터(`vm.overcommit_memory`)의 값에 따라서 달라진다.
그러면 왜 리눅스 커널은 이런식으로 메모리 커밋을 수행하면 바로 할당되는 것이 아니라 지연되게끔 개발 되었을까?

이유는 새로운 프로세스를 만드는 `fork()` 와 같은 시스템 콜을 처리해야되기 때문이다. 

서론에서도 잠깐 언급된 `fork()` 시스템 콜은 현재 커널에 실행 중인 프로세스와 똑같은 프로세스를 하나 만들게 된다. 그 프로세스는 후에 `exec()`와 같은 시스템 콜을 통해서 다른 프로세스로 변화한다.
이러한 상황이다보니 **확보한 메모리가 대부분 쓸모가 없어질 수도 있는 것**이다.

그래서 COW(Copy-On-Write)라는 기법을 통해서 복사된 메모리에 실제 쓰기 작업이 발생한 후에야 실질적인 메모리 할당을 시작한다.
이를 위해서 메모리 커밋이 필요하다. 

![](https://i.imgur.com/ODNgVTH.png)

위는 `fork()` 시스템 콜 상황에서 COW가 동작하는 원리를 보여준다. 이렇게 처리되기 때문에 메모리 커밋이 없으면 다음과 같은 상황이 발생할 수 있다.

![](https://i.imgur.com/h0lAhWM.png)

1기가의 가용메모리가 있고, 3GB의 프로세스를 `fork()` 를 통해서 복제한 상황이다. 이 케이스에 만약, 메모리 커밋처럼 지연처리가 없다면 OOM과 같은 문제도 발생할 수 있다.
어쨋든 메모리 커밋으로 위와 같은 상황에서도 오버커밋이 되긴했지만 쓰이기 전까지는 지연처리 되니 보다 안정성을 제공한다 볼 수 있다.

이 커밋 비율을 보기 위해서는 `sar` 와 같은 모니터링 도구를 활용할 수 있다. 커밋된 비율도 중요한 점이 순간적으로 시스템에 부하나 장애를 야기할 수 있기 때문에 위에서 잠깐 보았던 커널 파라미터인 `vm.overcommit_memory`를 통해 메모리 커밋에 대한 제어권을 사용자가 선택할 수 있게 하였다.

| 파라미터 옵션 | 동작 방시                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 0             | 기본동작 방식이며, overcommit 최댓값은 page cache + swap area + slab reclaimable 이다. (현재 가용 메모리 영역은 보지 않는다.) |
| 1             | 무조건 commit을 진행한다. 아무것도 계산하지 않으면 요청 온 모든 메모리에 대한 commit이 발생한다.                              |
| 2             | 제한적으로 commit을 진행한다. `vm.overcommit_ratio`에 대한 비율과 swap 영역에 대한 크기를 토대로 계산된다. (/proc/meminfo 에서 확인가능)                                                                                                                              |

### 2.3 프로세스의 상태 

위에서는 `VIRT`, `RES`, `SHR`를 다루면서 메모리 커밋에 대해서도 다뤘었다. 이제 `top` 명령어를 볼 수 있는 지표 중에 프로세스의 상태를 보는 지표를 확인할 차례이다.

![](https://i.imgur.com/CN6oaqZ.png)

해당 지표는 `SHR` 옆에 보이는 `S`라는 값이며 각 프로세스의 상태를 나타낸다.
프로세스의 상태는 아래와 같다.

| 상태 플래그 값 | 상태                   |
| -------------- | ---------------------- |
| D              | 디스크 혹은 네트워크 I/O를 대기하는 프로세스 (`TASK_UNINTERRUPTIBLE` 상태와 비슷)|
| R              | 실행 중인 프로세스를 의미하며, 실제로 CPU 자원을 소모하고 있는 프로세스 (`TASK_RUNNING` 상태와 비슷)         |
| S              | D 상태와 비슷하지만, 조기에 깨울 수 있는 상태의 프로세스 (`TASK_INTERRUPTIBLE` 상태와 비슷)   |
| T              | `strace` 등으로 프로세스의 시스템 콜을 추적하고 있는 상태의 프로세스(`__TASK_TRACED` 혹은 `__TASK_STOPPED` 상태와 비슷)      |
| Z              | 좀비상태의 프로세스로, 부모 프로세스가 죽은 자식 프로세스이다.                       |

위 값을 잘보면 우리가 서론에서 Run Queue와 Wait Queue를 다루면서 했던 내용과 흡사하다고 볼 수 있다.
우리는 어느정도 이 개념에 대해서 알고 있으니 바로 프로세스 상태 변화표를 확인해보자. 

![](https://i.imgur.com/zmNE7a6.png)

아마도 서론을 잘 읽었던 분이라면 이 부분에 대해서 이해하기 수월할 것이라고 생각한다.  위에서 다루지 않았던 내용은 좀비 상태 뿐인데 이건 아래의 표로 설명이 가능하다.

![](https://i.imgur.com/dVDQC44.png)

위 그림은 `fork()`를 통해서 자식 프로세스가 생성되는 모습을 보여주고 있다. 이런 케이스에 부모 프로세스가 죽었는데 자식 프로세스가 남아 있거나 자식 프로세스의 비정상 동작으로 부모 프로세스가 죽을 수 있다.

![](https://i.imgur.com/4wG4l9Q.png)

위와 같은 케이스가 좀비 프로세스가 된다고 보면 된다. 좀비 프로세스는 시스템의 리소스를 차지하지 않으므로 큰 문제는 되지 않으나 PID는 대략 65536개로 생성이 가능하기때문에 이 PID를 점유하고 있고, 새로운 프로세스가 할당될 PID가 부족하여 PID 고갈을 야기할 수 있다.

### 2.4 프로세스의 우선순위

이제는 `top` 명령어에서 볼 수 있는 지표인 `PR`과 `NI`에 대해서 알아보고자 한다.

![](https://i.imgur.com/n6IROxy.png)

이 두 개의 값은 모두 프로세스 우선순위와 연관되어있다.
Run Queue와 Wait Queue 과정에서 각 프로세스들이 어떻게 휴면상태로 바뀌고 다시 런상태로 바뀌고, 스케줄러가 해당 태스크들을 처리한다고 하였다.
이때, 실행될 프로세스의 우선순위를 통해서 스케줄러가 디스패처라는 개념에게 해당 프로세스에 대한 정보를 넘겨준다고 보면된다.

![](https://i.imgur.com/bXW9o3Q.png)

그렇다면, `PR`과 `NI` 지표는 어떤 것을 나타낼까?

| 지표 | 설명                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------- |
| PR   | 커널에서 인식하는 해당 프로세스의 실제 우선순위 값                                                       |
| NI   | nice값이라 부르며, 명령어를 통해 우선순위를 낮출 때 사용된다. (즉, 이 값을 통해서 PR 값을 낮출 수 있다.) |

실제로 nice 값을 낮추면 우선순위 낮은 프로세스가 먼저 수행될까?

```sh
#!/usr/bin/python

import datetime

start_time = datetime.datetime.now()
print("START : " + str(start_time))

sum = 0

for i in range(1,1000000000):
    sum = sum + i
    #print(i)
print(sum)

end_time = datetime.datetime.now()
print("END : " + str(end_time))

elapsed_time = end_time - start_time
print("Elapsed : " + str(elapsed_time))
```

위와 같은 파이썬 코드를 주고, 아래와 같이 두 개의 프로세스를 구동 시켰다.

![](https://i.imgur.com/tT3WdYH.png)

책에서는 5000만건으로 처리했는데 M1 Pro 프로세서의 단일 코어 성능이 좋아서 그런지 원하던 결과가 안나와서 10억번 반복을 돌도록 처리하였다.

```sh
ubuntu@ubuntu:~/example$ sudo python3 ex.py
START : 2023-08-23 10:53:48.624415
499999999500000000
END : 2023-08-23 10:55:23.304349
Elapsed : 0:01:34.679934

ubuntu@ubuntu:~/example$ sudo nice -n -20 python3 ex.py
START : 2023-08-23 10:53:48.879665 # nice를 -20으로 우선순위(PR)을 0으로 할당된 프로세스가 아래의 프로세스보다 늦게 수행
499999999500000000
END : 2023-08-23 10:55:21.738873 # 그러나 더 빨리 처리된 모습을 볼 수 있다.
Elapsed : 0:01:32.859208

ubuntu@ubuntu:~/example$ grep -c processor /proc/cpuinfo
1
```

VM으로 단일 코어로 처리했을 경우에 나오는 결과이다.
그러나, 단일 코어가 아닐 경우에는 위와 같이 nice값으로 우선순위를 올린 프로세스가 먼저 끝나는 것을 보장할 수가 없다.

이유는 바로 병렬성과 관련되어있다. 

![](https://i.imgur.com/w1oQ1VG.png)

2개 코어라고 가정하였을 경우 각각 코어 마다 Run Queue가 위치한다고 말했었다. 그러다보니 nice 값을 낮춰도 다른 코어에서 프로세스를 충분히 돌릴 수 있다면 nice 값을 낮춘 프로세스보다 빨리 끝날 수 있다.
실제 시작할 프로세스에 대한 nice 값은 `nice` 명령어로 처리할 수 있으며, 동작 중인 프로세스에 대한 핸들링은 `renice` 명령을 통해서 낮출 수 있다.

이때 사용되는 스케줄 방식이 바로 CFS(Completely Fair Scheduling)이다.

### 3. Load Averrage와 시스템 부하 

리눅스에서는 Load Average를 아래와 같이 정의한다.

> R과 D인 상태의 프로세스의 개수의 1분, 5분, 15분마다의 평균 값

즉, 얼마나 많은 프로세스가 실행 / 실행 대기 중이냐를 의미하는 수치이다.
이 값이 높다면 많은 수의 프로세스가 실행 중이거나 I/O를 처리하기 위해 대기 상태 있다는 것이고 낮으면 적은 수의 프로세스가 그렇다는 것이다.

이는 위에서 본 바와 같이 CPU 코어 수에 따라서 상대적이다.


![](https://i.imgur.com/OtiERRi.png)

두 개 모두 Load Average값은 2의 근사 값이 나올 것이다. (프로세스의 개수를 뜻하기 때문에) 그러나, 단일 코어일 경우에는 Run Queue에 두 개의 프로세스가 있으며, 듀얼 코어일 경우에는 각 Run Queue에 분리되어서 동작한다. 
즉, 병렬성이 보장되므로 듀얼코어인 케이스가 싱글코어인 케이스보다 대기 상태가 적을 수 밖에 없다.

따라서, 같은 Load Average라고 해도 CPU 코어 수에 따라 의미가 달라질 수 있다.

실제 커널 코드는 아래와 같다.

```c
// linux/kernel/sched/ladavg.c
void get_avenrun(unsigned long *loads, unsigned long offset, int shift)
{
	loads[0] = (avenrun[0] + offset) << shift;
	loads[1] = (avenrun[1] + offset) << shift;
	loads[2] = (avenrun[2] + offset) << shift;
}

static void calc_global_load(void)
{
	... (중략) ...
	
	active = atomic_long_read(&calc_load_tasks); // calc_load_tasks 값을 atomic_long_read() 매크로 함수를 통해서 읽은 후 active에 넣는다.
	active = active > 0 ? active * FIXED_1 : 0;

	avenrun[0] = calc_load(avenrun[0], EXP_1, active);
	avenrun[1] = calc_load(avenrun[1], EXP_5, active);
	avenrun[2] = calc_load(avenrun[2], EXP_15, active); // active 값을 바탕으로 avenrun[] 배열에 있는 값들을 calc_load_n() 함수를 이용해서 계산한다.

	... (중략) ...
}

long calc_load_fold_active(struct rq *this_rq, long adjust)
{
	long nr_active, delta = 0;

	nr_active = this_rq->nr_running - adjust; // nr_active 변수에 Run Queue기준으로 nr_running 상태의 개수를 adjust값을 뺴서 입력한다. (R 상태 프로세스)
	nr_active += (int)this_rq->nr_uninterruptible; // nr_uniterruptible 프로세스 개수도 nr_active 변수에 더해준다 (D 상태 프로세스)

	if (nr_active != this_rq->calc_load_active) {
		delta = nr_active - this_rq->calc_load_active; 
		this_rq->calc_load_active = nr_active; // nr_active 값이 기존 값과 다르면 clac_load_active 변수에 입력한다.
	}

	return delta;
}

```

참고 : https://github.com/torvalds/linux/blob/master/kernel/sched/loadavg.c#L71C1-L76
참고 2 : https://github.com/torvalds/linux/blob/master/kernel/sched/loadavg.c#L349C1-L380C1
참고 3 : https://github.com/torvalds/linux/blob/master/kernel/sched/loadavg.c#L78-L91

책에서 사용하는 커널버전과 다르다보니 좀 더 변경된 부분이 있으나, 매번 Tick 주기에 호출되는 [schedule_tick(void)](https://github.com/torvalds/linux/blob/master/kernel/sched/core.c#L5640) 함수를 보면 책에 나온 `calc_laod_account_active()` 함수 대신 `calc_global_load_tick()` 함수로 변경되었고, 이 함수 내부적으로 `calc_load_fold_active()` 함수를 호출하는 방식을 볼 수 있다.

![](https://i.imgur.com/awmZ9Ts.png)

위 내용을 정리하면 위와 같이 볼 수 있다. 함수명은 위에서 말한 듯이 커널 버전이 올라감에 따라 달라진 부분이 있으니 참고바란다.
결국 서두에서도 얘기했듯 R과 D 상태의 프로세스의 개수를 세는 것을 Load Average로 볼 수 있다.

#### 3.1 CPU Bound vs I/O Bound

따라서, Load Average 값이 높은 부분은 CPU가 많이 사용되는 프로세스(R)가 많을 수도 있고, I/O 대기에 따른 프로세스(D)가 많아서 일수 있다.
즉, 이 값만으로는 어떤 부하가 시스템이 겪고 있는지 알기가 힘든 것이다. 

이를 단순하게 확인하기 위해서 아래 2가지 파이썬 코드를 돌려보자.

```sh
#!/usr/bin/python
### CPU Bound 어플리케이션 예시

test = 0


while True:
	test = test + 1

#!/usr/bin/python
### I/O Bound 어플리케이션 예시

while True:
	f = open("./io_test.txt", 'w')
	f.write("test")
	f.close()
```

자 이 두가지 스크립트를 돌려보자
먼저 CPU Bound 어플리케이션일 경우다.

![](https://i.imgur.com/sctfpuy.png)

실제로 Load Average가 올라감을 확인할 수 있다.
그렇다면, I/O Bound 어플리케이션은 어떨까?

![](https://i.imgur.com/BEitHl1.png)

어떻게 보면 둘다 비슷한 Load Average를 보여주지만 실제로 주는 부하의 형태는 매우 다르다.
부하의 종류에 따라서 해결방법도 달라진다. 

여기서는 단순한 파이썬 스크립트를 통해서 보여줬지만 실제 웹 어플리케이션이나 실무에서 겪는 문제에서도 이 문제를 해결하는 방식은 달라진다.
CPU Bound 어플리케이션으로 인해 부하가 발생하면 신규 인스턴스를 투입하거나 로드밸런싱으로 부하분산을 할 수 있으나 I/O같은 경우에는 주로 DB같은데서 부하가 발생하므로 이중화해도 결국 똑같은 문제이다.
이는 별도로 처리를 해줘야한다.

이에 대해서 아주 자세히 설명한 강의가 있어서 이를 링크로 남겨본다.
https://class101.net/classic/products/T6HT0bUDKIH1V5i3Ji2M

그렇다면, Load Average가 부하의 성격은 보여주지 않는데 CPU Bound인지 I/O Bound인지 파악할 수 있는 방법이 있을까?
바로 `vmstat` 을 통해서 해결할 수 있다.

CPU Bound 어플리케이션을 수행 후에 확인해보자.

![](https://i.imgur.com/f1akP5D.png)

이제 I/O Bound 어플리케이션을 수행 후에 확인해보자. 

![](https://i.imgur.com/dAtEzvt.png)

포인트는 바로 `r` 과 `b` 열이다
+ r : 실행되기를 기다리거나 현재 실행되고 있는 프로세스의 개수 (nr_running)
+ b : I/O를 위해 대기열에 있는 프로세스의 개수 (nr_uniterruptible)

실제로 이러한 부하는 운영하는 입장에서 시스템에 미치는 영향은 다양하다.
이 때문에 실무에서 이러한 지표를 수집하는 것이라 볼 수 있다.

# 결론

이 책은 어떠한 명령어를 통해서 어떤 지표를 봐야하는 지와 그와 관련된 커널 내부 매커니즘을 설명한다. 
그렇다보니 OS에 대한 기본 배경지식이 없다면 읽기에 난이도가 높을 수 있다고 볼 수 있다.

하지만, 책 자체가 친절하게 적혀있어서 더 궁금한 부분은 독자들의 몫으로 남겨줬다고 생각한다.

우리는 초기에 이 기본 개념들을 이해하기 위한 최소한의 배경지식을 배웠고, 그 뒤로 커널 스케줄링이나 컨텍스트 스위치 개념 그리고 Load Average에 대한 개념을 배우게 되었다.
책에서는 웹서버를 실제로 열어서 Load Average를 재곤했는데 이 부분은 생략하였다.

궁금하신 분이 계시다면 책을 사서 읽기를 추천드린다.

커널 공부를 하면서 느끼는 점은 결국 기본기가 매우 중요하다는 점이다.
특히, 운영체제는 공부할 내용도 방대하고 엄두가 안날 때가 많다. 하지만 운영체제에서 쓰이는 개념들은 결국 웹 어플리케이션이나 프로그래밍 언어에서도 쓰인다.

대표적으로 자바의 NIO에서는 기존 I/O의 성능을 올리기 위해서 OS 레벨의 기능들을 제공해주는데 그 중 대표적인 기능이 MMIO다.
또한, 실제 어플리케이션들을 운영할 때 왜 이런식으로 튜닝하기를 권장하는 지 등도 운영체제를 공부하는데 도움이 된다.

위 내용과 관련된 필자의 포스팅은 아래와 같다.

1. [자바 NIO의 동작원리 및 IO 모델](https://brewagebear.github.io/fundamental-nio-and-io-models/)
2. [왜 처리량이 중요한 JVM 어플리케이션은 vm.swappiness = 1로 설정하라고 할까?](https://brewagebear.github.io/fundamental-os-page-cache/)

필자는 무협소설이나 웹툰을 좋아하는 편인데 무협지에는 이러한 대사가 많이 나온다.

> 수단과 과정은 달라도 극에 달하면 결국 같은 걸로 귀결 된다. 정파든 사파든 마도든 극에 이르는 것은 같다.

즉, 만류귀종이라고 볼 수 있다. 요즘 추상화된 레벨보다는 로우레벨 배경의 공부를 하다보니 문뜩 든 생각이었다.
어? 이 개념 이거랑 같은데? 보면 비슷하고 그랬었다. 아직은 무림초출급 내공이지만 언젠가 공부를 계속하다보면 극에 달할 때가 올까?

그 부분은 모르겠지만 궁금해서 하는 공부가 제일 재밌는 것 같다.

# 참고자료

1. [COMS W4118 Operating Systems 1 - Columbia University](https://cs4118.github.io/www/2023-1/)
2. [시그널: 유저 공간에서 pause() 함수 호출 시 커널 실행 흐름 파악하기 - Austin Kim](https://blog.naver.com/PostView.naver?blogId=crushhh&logNo=221568455956)
3. [The Liunx Scheduling Algorithm - Team LiB](http://books.gigatux.nl/mirror/kerneldevelopment/0672327201/ch04lev1sec2.html)
4. [wait Queue - 달려라](https://blog.naver.com/sysapi/20011482139)
5. [Memory Mapping - Seoul National University](http://csl.snu.ac.kr/courses/4190.307/2020-1/9-mmap.pdf)

