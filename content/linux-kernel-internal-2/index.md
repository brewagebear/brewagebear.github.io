---
title: "[Kernel] 리눅스 메모리 관리 훑어보기"
date: 2023-09-04 17:10:00 +0900
tags:
  - Linux
  - Core
emoji: 💻
author: 개발한입
categories: 개발 인프라 독서요약
---

# 개요 

이전 포스팅 

1. [[Kernel] 리눅스 스케줄링 매커니즘과 Load Average](https://brewagebear.github.io/linux-kernel-internal-1/ )

이전 내용에서는 커널을 이해하기 위한 배경지식과 더불어, `top`에서 나타내는 지표들을 읽는 법 그리고 Load Average가 어떤 부분을 나타내는 지 중점적으로 알아보았다. 

이번 내용에서는 리눅스 내부 메모리 관리에 대해서 중점적으로 다룬 후 `free` 와 `proc/meminfo` 가 나타내는 지표들에 대해서 보고자 한다. 그 전에 앞서 역시 이 부분 또한, 배경지식이 필요하다보니 배경지식에 대해서 다루고, 메모리와 관련된 지표들에 대한 내용을 다뤄보고자 한다.

## STEP 1. 서론

## STEP 1.1 가상 주소 공간

<p align="center">
    <img src="https://i.imgur.com/7uArXuJ.png">
</p>
<p align="center">
    <em>그림 1. 리눅스의 가상 주소 공간 매핑 예시</a></em>
</p>

이전 장에서 이러한 그림을 토대로 가상 주소 공간(Virtual Address Spaces, VAS)[^1] 에 대해서 간략하게 다뤘었다.  메모리 관리에 들어가기 앞서 가상 주소 공간에 대해서 좀 더 알 필요가 존재하여 이에 대해서 다뤄보고자 한다.

이를 이해하기 위해서는 먼저 중요한 구조체 몇개를 파악할 필요가 있다.

## STEP 1.2 task_struct와 mm_struct에 대한 이해

`task_struct`는 이전 포스팅에서 Run Queue를 다루면서 잠깐 설명을 했었던 적이 있다.
이 `task_struct` 구조체는 리눅스 커널에서 매우 중요한 구조체이므로, 이야기를 하고 넘어가고자 한다.

먼저, 리눅스에서는 작업의 기본 단위를 태스크(Task)라 부른다. 태스크는 프로세스와 동치되는 개념이라고 생각하면 된다. 
운영체제도 소프트웨어다보니 이 태스크를 나타내거나 처리할 자료구조가 필요할 것이다. 그것이 `task_struct` 이다.  

근데, 여기서만 이야기를 끝내면 안된다. 학부생때 운영체제 과목을 수강했다면 프로세스 제어 블록(Process Control Block, PCB)[^2] 라는 단어를 들었던 기억이 어렴풋이 날 것이다.

그  PCB도 `task_struct` 라는 구조체로 구현이 된다. 따라서, 기본 작업인 태스크와 PCB도 모두 `task_struct` 라는 구조체로 이뤄진다는 점이다. 

그렇다면 쓰레드의 경우에는 어떨까? 이는 운영체제에 따라 다르다.

+ Windows (NT Kernel)

<p align="center">
    <img src="https://i.imgur.com/qrf20s5.png">
</p>
<p align="center">
    <em><a href="https://linux-kernel-labs.github.io/refs/heads/master/lectures/processes.html">그림 2. Windows 커널의 쓰레드 구조, The Linux Kernel(5.10.14), Processes </a></em>
</p>

윈도우즈의 경우를 본다면, 위 그림과 같이 `Thread list`에 각 쓰레드 구조에 대한 포인터가 등록되는 식으로 관리된다고 보면 된다.  그러나, 리눅스의 경우에는 아래 그림과 같다.

<p align="center">
    <img src="https://i.imgur.com/qrf20s5.png">
</p>
<p align="center">
    <em><a href="https://i.imgur.com/c9oEUO6.png">그림 3. Linux 커널의 쓰레드 구조, The Linux Kernel(5.10.14), Processes </a></em>
</p>

위 그림은 같은 프로세스 내에 쓰레드가 2개가 있다고 가정한 모습이다. 각 쓰레드 또한 `task_struct`를 활용하여 구현되며 단순히 같은 프로세스 내의 쓰레드라면 동일한 리소스 구조 인스턴스를 가르킬 뿐이다. 

실제 `task_struct` 코드 중에서 중요한 부분만 발췌하면 아래와 같다.

```c
// https://github.com/torvalds/linux/blob/master/include/linux/sched.h#L743
struct task_struct {
	struct thread_info		thread_info;
	...
	unsigned int			__state;
	...
	struct sched_info		sched_info;
	struct list_head		tasks;
	...
	struct mm_struct		*mm;
	struct mm_struct		*active_mm;
}
```

위 코드에서 중점적으로 볼 내용은 `mm_struct` 이다.  태스크도 `task_struct` 를 통해서 만들어진다고 하였는데 그렇다면 우리가 기존에 알고 있던 `stack` , `heap` 영역은 어디에 할당되는지 궁금하지 않은가? 

그 공간이 바로 `mm_struct` 구조체로 관리된다. 이 구조체는 가상 주소 공간을 관리하기 위한 여러 정보를 포함하고 있다. 

```c
// https://github.com/torvalds/linux/blob/master/include/linux/mm_types.h#L598
struct mm_struct {
	struct {
		...
		struct maple_tree mm_mt;
	}
	...
	unsigned long start_code, end_code, start_data, end_data;
	unsigned long start_brk, brk, start_stack;
	...
}
```

위 구조체도 매우 복잡한데 현재 설명할 내용과 관련된 필드는 위에 나온 정도라 보면된다. (`maple_tree`는 후에 설명한다.)
+ `start_code / end_code` : 프로세스의 코드 영역의 시작과 끝을 나타냄
+ `start_data / end_data` : 프로세스의 데이터 영역의 시작과 끝을 나타냄
+ `start_brk / brk` : 프로세스의 힙 영역의 시작과 끝을 나타냄
+ `start_stack` :  스택 영역의 시작을 나타냄

이제 아래의 그림을 이해할 수 있을 것이다.

<p align="center">
    <img src="https://i.imgur.com/uef6DfS.png">
</p>
<p align="center">
    <em>그림 4. 리눅스 가상 메모리 영역 시각화</a></em>
</p>

프로세스 내부의 `mm_struct` 를 시각화한 그림이다. 우리가 힙 영역을 늘리고 싶다면, `brk()` 라는 시스템 콜을 통해서 늘리거나 줄일 수 있다.

`brk()` 시스템콜은 프로그램 브레이크(Program Break)[^3] 를 제어하는 시스템 콜이라고 보면 된다. 위에서 보면 알겠지만 `brk` 라는 값을 통해서 `heap` 크기를 늘리고 줄일 수 있는 것을 볼 수 있다.

이 `brk()` 시스템 콜을 통해 프로그램 브레이크를 증가시키면, **프로세스에 메모리가 할당**되고 감소하면 **프로세스의 메모리를 해제**할 수 있는 것이다.

## STEP 1.3 가상 메모리 영역(Virtual Memory Area, VMA)

위 `mm_struct`필드 중에서 `maple_tree` 의 타입을 갖는 `mm_mt` 라는 값이 존재하였는데 이 부분도 중요하다보니 다루고자 한다.
이를 이해하기 위해서는 이전 커널 버전을 볼 필요가 존재한다.

+ 6.1 이전 커널의 `mm_struct`

```c
struct mm_struct {
	struct {
		struct vm_area_struct *mmap; /* list of VMAs */
		struct rb_root mm_rb; // 레드블랙트리의 루트
		...
	}
...
```

이러한 코드로 `vm_area_struct` 를 사용하였다.  그러나 6.5 이후는 위에서 본 코드와 같이 `*mmap` 부분이 `maple_tree`로 변경되었다.

```c
struct mm_struct {
	struct {
		...
		struct maple_tree mm_mt;
	}
...
```

이에 대한 구체적인 내용은 아래 링크를 참고 바란다.
+ 참고 커밋 : [mm: start tracking VMAs with maple tree, Github](https://github.com/torvalds/linux/commit/d4af56c5c7c6781ca6ca8075e2cf5bc119ed33d1#diff-dc57f7b72015cf5f95444ec4f8a60f85d773f40b96ac59bf55b281cd63c06142)
+ 참고 자료 : [The Maple Tree, A Modern Data Structure for a Complex Problem, Oracle](https://blogs.oracle.com/linux/post/the-maple-tree-a-modern-data-structure-for-a-complex-problem)

`vm_area_struct`가 기존에는 레드블랙트리(`rbtree`)[^6] 로 추적되었는데  숫자 순서로 노드를 탐색하는 것이 효율적이지 않았고, 기존 락에 대한 문제점이 존재하였다고 한다.
이에 대해서 새로운 데이터 구조가 필요하였고, 메이플트리(Maple Tree)[^7] 를 제안하였다고 한다.  

`mm_mt` 값은 VMA를 순회를 할 때 사용된다고 보면 된다.  중요한 점은 `vm_area_struct` 로 관리되던게  `maple_tree` 로 변경되었다는 점이고, 실제 내부 값은 `vm_area_struct` 를 사용한다.

```c
// @mas : the maple state
void vma_mas_store(struct vm_area_struct *vma, struct ma_state *mas);
```

이제, `vm_area_struct`에 대해 이해해보자.

위에서 `mm_struct` 에 대해서 네 가지 구조로 나눌 수 있다고 말했었다.
1. 스택 영역 
2. 힙 영역
3. 데이터 영역
4. 코드 영역

이 영역들을 통틀어 **가상 메모리 영역(Virtual Memory Area, VMA)** 이라 한다. 즉, `vm_area_struct` 는 가상 메모리 영역에 대한 데이터 구조를 나타낸다.

```c
//https://github.com/torvalds/linux/blob/master/include/linux/mm_types.h#L565
struct vm_area_struct {
	union {
		struct {
			/* VMA covers [vm_start; vm_end) addresses within mm */
			unsigned long vm_start;
			unsigned long vm_end;
		};
	...
	struct mm_struct *vm_mm;
	pgprot_t vm_page_prot;          /* Access permissions of this VMA. */
	
	union {
		const vm_flags_t vm_flags;
		vm_flags_t __private __vm_flags;
	};
	...
	struct list_head anon_vma_chain; /* Serialized by mmap_lock &  page_table_lock */
	struct anon_vma *anon_vma;	/* Serialized by page_table_lock */
	...
	unsigned long vm_pgoff;		/* Offset (within vm_file) in PAGE_SIZE units */
	struct file * vm_file;		/* File we map to (can be NULL). */
	...	

```

중요한 필드 몇 가지만 봐보자.

+ `vm_start, vm_end` : VMA 영역의 시작 주소와 끝 주소를 나타냄 ($VMA_{SIZE} = VM_{END} - VM_{START }$)
+ `*vm_mm` : 해당 VMA가 속해있는 `mm_struct`를 나타낸다.
+ `vm_page_prot` : 해당 VMA에 접근하고자할 경우에 대한 권한 값 (read only, rw 등)
+ `vm_flags` : `vm_page_prot`의 권한 하위 집합을 지정할 수 있다. (`VM_READ | VM_WRITE | VM_GROWS_DOWN` 등..)
	+ 참고 : [Linux – vm_flags vs vm_page_prot, iTecNote](https://itecnote.com/tecnote/linux-vm_flags-vs-vm_page_prot/)

이 후 값은 MMIO에 대한 이해가 필요하니 이전 포스팅에서 익명 매핑(Anonymous Mapping)과 파일 매핑(File-backed Mapping)에 대해서 알고 오길 추천드린다.
 
위에서 `anon_vma, anon_vma_chain` 은 익명 매핑 시에 사용되고, `vm_pgoff, vm_file`은 파일 매핑 시에 사용이 된다.

두 가지 구조로 따로 나눈 이유는 역방향 매핑과 관련되어 있는데 이 부분은 페이징때 자세히 다루도록 하고 간단하게 링크만 달아두도록 하겠다.

+ `vm_file` : 파일 매핑을 사용할 경우 사용되는 실제 파일에 대한 링크를 갖는 구조체 
+ `vm_pageoff` : 해당 파일 내의 offset을 나타낸다.

+ `anon_vma` : 익명 매핑을 사용할 경우 사용되는 구조체 
+ `anon_vma_chain` : `anon_vma` 만 사용하였을 경우 문제점을 해결하기 위해 도입된 필드 

> 익명 역 매핑(Anonymous Page Reverse Mapping) 매커니즘은 페이지 매핑을 해제한 후 매핑될 PTE(Page Table Entry)[^9] 찾기 위해 전체 연결 목록인 `vma`에 액세스한 후 순회하여 연결 목록에 액세스하는데 `fork()`를 통해 복사된 하위 프로세스에서 쓰기 액세스가 발생하면 `vma`에 새 익명 페이지가 할당되고, `vma`는 이 익명 페이지를 가르키게 되는데 이 페이지가 `vma`에 반영되지 않는 문제점이 존재하였음.

+ 참고 : [Reverse mapping of anonymous pages in Linux, SoByte](https://www.sobyte.net/post/2022-08/linux-anonymous-pages-reverse-mapping/)

리눅스 커널에서 프로세스가 할당되어 사용되는 구조를 각 구조체를 통해서 나타내면 아래와 같다. 

<p align="center">
    <img src="https://i.imgur.com/sRBzgjS.png">
</p>
<p align="center">
    <em><a href="https://cs4118.github.io/www/2023-1/lect/21-linux-mm.html#struct-vm_area_struct-source-code">그림 5. Virtual address space with kernel data structures, COMS W4118 Operating Systems 1 - Columbia univ, 2023</a></em>
</p>


`vm_next, vm_prev` 는 메이플 트리 도입[^9] 이후로 삭제가 되었고, `mm_struct`가 가르키는 것이 `mmap` 이 아니라 `mm_mt`로 변경되긴 해야겠지만 전반적인 큰 틀은 흡사하므로 이해할 수 있을 것이다.

해당 그림을 이해를 못하겠다면 다시 한번 읽어보는 것을 추천드린다.  위에서 강조한 내용처럼 **지금까지 다룬 구조체들은 커널에서 가장 중요한 구조체들**이다.

## STEP 1.4 프로세스가 가상 주소 공간에 매핑되는 방식

우리는 위에서 커널에서 중요한 구조 중 하나인 `task_struct` 와 `mm_struct`, `vm_area_struct` 에 대해 알아보았다. 
이제 이 개념이 왜 중요한지 알아보도록 한다. 일단, 이를 위해서는 매핑되는 방식에 대해서 이해 해야한다.

<p align="center">
    <img src="https://i.imgur.com/C9mJAyt.png">
</p>
<p align="center">
    <em><a href="https://cs4118.github.io/www/2023-1/lect/21-linux-mm.html#process-virtual-address-space-re-revisited">그림 6. virtual address space diagram, COMS W4118 Operating Systems 1 - Columbia univ, 2023</a></em>
</p>

실제 가상 주소 공간에 매핑되는 구조를 나타낸 그림이다. 매핑 방식은 2가지 방식이 있다.

1. 간접 매핑(Indirect Mapping) : 가상 주소와 물리 주소 사이의 매핑이 페이지 테이블(Page Table)[^4] 을 통해서 이뤄지는 구조이다. (OS와 하드웨어가 주소 변환을 수행해야함.)
2. 직접 매핑(Direct Mapping, Linear Mapping) : 직접 매핑은 가상 주소와 물리 주소 사이에서 선형적(Linear)으로 이뤄진다. 리눅스 커널의 일부는 커널 코드와 데이터, 시스템 테이블 등을 저장하는데 이용되며 모든 프로세스에 대해 공유된다. (선형적으로 매핑되어서 보다 단순함.)

> 💡 직접 매핑에서 나온 선형적으로 매핑이 이뤄진다는 뜻은 가상 주소가 0x1000이고, 물리 주소 0x2000에 매핑되었다면 선형 매핑을 사용하면 가상 주소 0x1004는 물리 주소 0x2004에 매핑이 된다.

또한, 모든 프로세스는 커널 코드 & 데이터 영역에 대한 공유를 하기 위해 직접 매핑된 값들이 존재한다.
그렇다면 왜 이런식으로 나누었을까? 

<p align="center">
    <img src="https://i.imgur.com/3JkVM2I.png">
</p>
<p align="center">
    <em><a href="https://linux-kernel-labs.github.io/refs/heads/master/lectures/address-space.html#linux-address-space">그림 7. Dedicated, Shared Address Space, The Linux Kernel(5.10.14), Linux Address Space</a></em>
</p>

우리는 알다시피 유저 공간과 커널 공간이 나눠져있다는 점을 알고 있다.  위 그림은 그 공간을 나누는 방식에 대한 방식을 나타낸다. 
(a)는 전용 주소 공간(Dedicated Address Spaces)를 뜻하며, (b)는 공유 주소 공간을 분할(Split a Shared Address Space)하는 것을 보여준다.

이는 각각 장, 단점이 존재한다.

+ 전용 커널 공간의 단점(a) : 모든 시스템 호출에 대한 TLB 완전 무효화 
+ 공유 주소 공간의 단점(b) : 커널 및 사용자 프로세스 모두를 위한 주소 공간 자체가 감소 

과거에는 (a)의 형태가 많았지만 주로 (b)와 같이 공유 주소 공간을 분할하는 식으로 사용한다. (특히, 64bit 환경은 항상 공유 주소 공간으로 처리된다 한다.)

공유 주소 공간을 사용하는 아키텍처라고 가정했을 때, 각 공간은 아래의 특징을 갖는다.
+ **유저 공간(User Space) : 권한 있는 작업을 수행하거나 하드웨어에 직접 액세스를 할 수 없다.**
+ **커널 공간(Kernel Space) : 권한 있는 작업을 수행할 수 있으며 하드웨어에 대한 전체 액세스 권한이 있다.**

따라서, CPU에서 **어떤 작업을 유저 공간에서 수행 중에 권한이 필요한 작업이 존재하면 커널 공간에 요청을 해야한다**. 

예를 들어, 유저 공간에 `read()` 혹은 `write()` 와 같이 시스템 콜이 발생한다고 가정하면 아래와 같은 플로우로 흘러간다.
 
1. 유저 공간에서 데이터로 복사하려면 커널 버퍼의 가상 주소를 사용한다.
2. 페이지 테이블을 이동하여 커널 버퍼의 가상 주소를 물리적 주소로 변환한다.
3. 커널 버퍼의 물리적 주소를 사용하여 DMA 전송을 시작한다. 

근데, 만약 커널 공간이 **직접 매핑이 되어있다면 2번에 대한 작업이 축소가 되어서 아래와 같이 처리가 가능**할 것이다.

1. 가상 주소 공간에서 물리적 주소 공간으로의 변환이 페이지 테이블을 통해서 처리되는 대신 한번에 처리가 가능하다. 
2. 페이지 테이블을 만드는 데 사용되는 메모리가 적어진다.
3. 커널 메모리에 사용되는 TLB(Translation Look-aside Buffer)[^5] 항목 수 감소

그래서 실제로 가상 주소 공간은 아래와 같이 분할되어 사용된다.

<p align="center">
    <img src="https://i.imgur.com/fxDD1wV.png">
</p>
<p align="center">
    <em><a href="https://cs4118.github.io/www/2023-1/lect/21-linux-mm.html#struct-page-source-code">그림 9. Users, Kernel Space Diagram, COMS W4118 Operating Systems 1 - Columbia univ, 2023</a></em>
</p>


커널 공간은 대부분 직접매핑이 되어 쓰이고(`Lowmem` 부분), 아주 일부분은 간접매핑되어 쓰인다. (`Highmem`)
이 부분은 `Slab` 을 다룰 때 다뤄볼 예정이다. 

어찌됐든 간에 중요한 점은 유저 공간과 커널 공간이 공유 주소 공간을 사용하여 일정 부분 별로 나눠져있고, 이에 대해 직, 간접 매핑을 활용하여 각자의 장단점을 누릴 수 있게끔 설계되었다는 점이 중요하다.

## STEP 1.4 페이지와 페이지 캐시

### STEP 1.4.1 페이지

나중에 페이징을 별도로 포스팅할 예정인데 그 전에 리눅스 메모리 관리에 이해하려면 어찌됐든 페이지에 대해서 알긴 해야되서 간단하게 코드만 보고자 한다.

각 물리적 프레임(Physical Frame)[^11]은 `struct page`라 부르는 페이지 값을 가지게 되는데 이 값은 물리적 프레임에 대한 메타데이터를 담고 있다.

실제로 글로벌 메모리를 설정하는 부분에 전역 배열로 `struct page` 값을 사용한다.

```c
// https://github.com/torvalds/linux/blob/master/mm/memory.c#L102
struct page *mem_map;
```

커널은 모든 물리적 프레임을 `mem_map`에 저장한다. 그러나, 이에 직접 접근하는 것은 좋은 방법은 아니기에 다양한 메서드들을 제공(`virt_to_page(), kmap(), kunmap()` 등...)하는데 이는 `struct page`를 살펴보고 알아볼 예정이다.

이제 `struct page` 에서 중요한 필드들을 확인해보자.

```c
https://github.com/torvalds/linux/blob/master/include/linux/mm_types.h#L74C8-L74C12
struct page {
	union {
		struct {	/* Page cache and anonymous pages */
			/**
			 * @lru: Pageout list, eg. active_list protected by
			 * lruvec->lru_lock.  Sometimes used as a generic list
			 * by the page owner.
			 */
			...
			struct list_head lru;
			...
			struct address_space *mapping;
			...
			pgoff_t index;	
			...
	...
	atomic_t _refcount;
	...
	void *virtual;
	...
```

+ `_refcount` : 페이지의 레퍼런스 카운트를 뜻하며, `page_count()` 로 접근할 수 있다.
+ `lru` : LRU 캐시 교체(Cache replacement policies) 정책을 수행하는 Linux 데이터 구조의 항목이다.
+ `*mapping, index` : 위에서 다루었던 익명(Annoymous), 파일(File-backed) 매핑과 관련된 필드이다.
+ `*virtual` :물리적 프레임에 대응하는 커널 가상 주소 

이제 페이지 매핑과 관련해서 보도록하자. 

```c
https://github.com/torvalds/linux/blob/master/arch/arm/include/asm/memory.h#L318-L328
static inline phys_addr_t virt_to_phys(const volatile void *x)
...
static inline void *phys_to_virt(phys_addr_t x)
...
```

해당 함수는 물리적 주소를 가상 주소로 변환(`*phys_to_virt`)하거나 가상 주소를 물리적 주소로 변환(`virt_to_phys`)로 하는 작업을 해준다.

이제 아래의 그림을 다시 봐보자.

<p align="center">
    <img src="https://i.imgur.com/fxDD1wV.png">
</p>
<p align="center">
    <em><a href="https://cs4118.github.io/www/2023-1/lect/21-linux-mm.html#struct-page-source-code">그림 9. Users, Kernel Space Diagram, COMS W4118 Operating Systems 1 - Columbia univ, 2023</a></em>
</p>

위 그림은 32bit 4GB 가상 주소 공간을 가정한 것이다. 전통적으로 3:1의 비율(유저공간:커널공간)로 분할되게 된다. (64bit는 달라질 수 있음)

`Highmem` 영역에서 프레임을 사용하기 위해서는 `struct page`를 `kmap()`을 사용해야한다. 

```c
//https://github.com/torvalds/linux/blob/master/include/linux/highmem.h#L37-L46
...
static inline void *kmap(struct page *page);
...
static inline void kunmap(struct page *page);
```

이 메서드는 `Highmem` 프레임을 `Lowmem`에 있는 것처럼 참조할 수 있도록 매핑을 생성하며, 이미 사용하고자하는 프레임이 `Lowmem`에 존재한다면 주소를 반환한다.

이와 같은 **메서드를 통해 프레임이 메모리에서 어디있는지 걱정하지 않고 사용**할 수 있게 된다.
그러나, 이 매핑에도 제한적인 부분이 존재하므로 `kunmap()` 을 통해서 매핑을 해제해줘야한다.

### STEP 1.4.2 페이지 캐시

위에서 잠깐 페이지에 대해서 다뤘는데 이제 페이지 캐시(Page Cache)[^12] 에 다뤄보고자 한다. 위에서 `vm_area_struct` 를 볼 때 아래와 같은 필드가 존재하였었다.
`struct file * vm_file;` 여기서 `struct file`은  `struct inode` 의 참조 값이라 보면 된다. 그리고 `struct inode`는 내부에 `struct address_space *i_mapping` 과 같은 값을 갖고 있다.

이것은 `inode`와 관련된 파일의 모든 프레임에 대한 참조이다. 이 구조는 **파일 매핑만 사용하는 것이 아니라 캐시된 페이지를 보유**할 수 있다.

운영체제를 공부하셨던 분이라면 읽고 쓰는 작업이 항상 디스크까지 가서 확인하는 것은 아니라는 점을 알고 있을 것이다. 
그것이 가능한 이유는 캐시를 통해서 이미 한번 읽어드렸으면 잠시 메모리 영역에 들고 있게끔해서 디스크까지 내려가지않고 다시 읽게끔한다는 식으로 동작한다는 것을 말이다.

그것이 **바로 페이지 캐시의 역할**이다. 이를 읽기와 쓰기를 나눠서 플로우를 살펴보자.

+ **읽기 작업 발생 시**
	1. `read()` 시스템 콜 발생 
	2. 페이지 캐시가 존재한다면 -> 페이지 캐시를 리턴 
	3. 페이지 캐시가 존재하지 않는다면 -> 디스크에서 데이터를 읽고, 해당 데이터에 대한 페이지 할당 후에 `address_space`에 연결하여 캐싱 

+ **쓰기 작업 발생 시** 
	1. `write()` 시스템 콜 발생
	2. 페이지 캐시가 존재하든 안하든 -> 페이지 캐시에 기록 및 페이지를 dirty로 표시(이것이 더티 페이지이다.)
	3. `sync()` 를 통해서 디스크에 기록 

쓰기 작업 부분은 페이지 캐시가 존재하든 안하든 결국 메모리에 캐시를 생성하는데 이를 write-back 캐시라 한다. 요청 시 캐시와 디스크에 동시 기록하는 것을 write-through 캐시라 부른다.
리눅스는 기본적으로 write-back 캐시의 방식을 따른다고 알고있다.

쓰기 작업 부분은 다른 포스팅에서도 다뤘는데 자세한 내용은 아래의 링크를 참고바란다.
+ 참고 : [페이지 캐시와 더티 페이지 동기화](https://brewagebear.github.io/fundamental-os-page-cache/#step-221-%ED%8E%98%EC%9D%B4%EC%A7%80-%EC%BA%90%EC%8B%9C%EC%99%80-%EB%8D%94%ED%8B%B0-%ED%8E%98%EC%9D%B4%EC%A7%80-%EB%8F%99%EA%B8%B0%ED%99%94)


이 뿐만 아니라 하나더 봐야하는 작업이 있다 바로, MMIO 관련 작업이다.

+ **MMIO 작업과 관련된 페이지 캐시**
	1. 파일 매핑(File-backed Mapping)을 사용하는 경우에 페이지 캐시를 사용한다. 
		+ 새로운 VMA가 생성 된 후 파일 내용이 메모리로 전달되려할 때 페이지 폴트가 발생 하고, 페이지 캐시의 페이지는 해당 작업의 페이지 테이블에 인입된다.
	2. `MAP_SHARED` 로 페이지를 공유하고 있는 경우에는 페이지 캐시의 동일한 페이지를 대상으로 동작한다. 

시각화하면 다음과 같을 것이다.

<p align="center">
    <img src="https://i.imgur.com/eDm8R8E.png">
</p>
<p align="center">
    <em><a href="https://cs4118.github.io/www/2023-1/lect/21-linux-mm.html#page-cache-visualized">그림 10. Page Cache Visualized, COMS W4118 Operating Systems 1 - Columbia univ, 2023</a></em>
</p>


### STEP 1.4.3 페이지 교체 정책 

페이징에서 정책에 대해서 좀 더 다룰 내용이라 여기서는 LRU 정책[^13]에 대해서만 다루고자 한다.
LRU(Least Recently Used)의 약어로 잘 안쓰였던 페이지부터 교체하는 방식이다.

리눅스 페이지는 LRU/2로 알려진 2Q 교체 정책을 사용한다.

기존 LRU 알고리즘은 아래와 같은 패턴으로 사용할 경우 성능이 나쁘다고 볼 수 있다.

> 한 프로세스가 큰 파일을 매핑 후 한번 읽은 후 다시 절대로 사용하지 않는다고 가정하자
> 만약, 이 파일을 매핑하기 위해서 캐시 전체를 교체를 한 후 이 파일 1개만 있다면 어떻게 될까? 
> 이러한 일회성 액세스에 대해서 캐시를 보호하는 작업이 필요할 것이다.

그림으로 봐보자.

<p align="center">
    <img src="https://i.imgur.com/eMDgcCM.png">
</p>
<p align="center">
    <em>그림 11. LRU 성능 최악의 케이스</a></em>
</p>

이런식의 상황이다. 근데 이 파일은 절대로 접근하지 않는다고 가정한다. 그러면 다시 해당 캐시가 방출될 것이다.
그러면, 기존에 자주 접근할 수도 있는 캐시 자체가 날라가버리니 다시 이 웜업하는데 시간이 많이 걸릴 것이다.

이러한 문제를 해결 하기위해서 LRU/2라는 개념이 도입된 것이다.
이 개념은 아주 간단하다. 캐시를 관리하는 리스트를 2개를 두는 것이다.

<p align="center">
    <img src="https://i.imgur.com/X0aMm4K.png">
</p>
<p align="center">
    <em><a href="https://biriukov.dev/docs/page-cache/4-page-cache-eviction-and-page-reclaim/#theory">그림 12. LRU/2, Viacheslav Biriukov</a></em>
</p>



1. 비활성 LRU 리스트(Inactive LRU List) 
	+ 초기 페이지 부재가 발생한 후 페이지 캐시로 등록하고자하면 비활성 리스트에 인입되게 된다.
	+ 이후 어떤 페이지가 자주 참조가 발생하면 활성 LRU 리스트로 승격(promotion)시킨다.
2. 활성 LRU 리스트(Active LRU List) 
	+ 자주 사용하지 않는 페이지가 발생하면 비활성 LRU 리스트로 좌천(demotion)된다. 
	+ 이때 좌천이 발생할 경우 `flush()` 가 호출되어 실제 디스크에 기록이 된다.

참고로, 이 구조는 MySQL의 버퍼풀이 그대로 따르고 있으니 참고해보기 바란다.
+ 참고 : [MySQL Innodb Buffer Pool 구조 및 캐시 전략, 고양이 중독](https://omty.tistory.com/58)

## STEP 2. 본론

역시나 이전 포스팅과 같이 어떠한 개념을 이해하기 위해서 배경지식이 많이 필요하였다.
대충 위의 배경지식을 이해하였더라도 이제 본론의 내용에 대해서 충분히 숙지할 수 있는 기본 지식이 갖춰졌다고 생각한다.

이번에 보려고 하는 내용은 `free` 명령어와 관련된 내용이다. 이 `free` 에 대한 내용을 다루기 위해서 멀리 돌아돌아왔다.
이제 이 내용에 대해서 다뤄보겠다.

## STEP 2.1 free 명령어 분석 

`free -m` 명령어는 아마도 다들 써본 명령어일 것이다. 명령어를 수행하면 아래와 같은 결과가 나온다.

```sh
ubuntu@ubuntu:~$ free -m
               total        used        free      shared  buff/cache   available
Mem:            3911         129        3571           4         210        3632
Swap:           3910           0        3910
```

하나씩 보도록 하자.

+ `used` : 시스템에서 사용하고 있는 메모리 양을 의미한다. 
+ `free` : 시스템에서 사용하고 있지 않은 메모리 양을 의미한다.
+ `shared` : 프로세스 사이에 공유하고 있는 메모리 양을 의미한다.
+ `buff/cache` : 버퍼와 캐시 영역(페이지 캐시)의 총 메모리 양을 의미한다.
+ `available` : `buff/cache` 영역을 포함하여 사용하지 않는 영역의 메모리 양을 나타낸다. (그러나 단순 더하기는 아닌데 이건 밑에서 다룰 예정이다.)
	+ 원래는 `-/+ buffers/cache` 라는 지표가 Mem 라인 아래에 존재하였는데 `avaliable` 지표로 바뀌었다

### STEP 2.1.1 buff와 cache 영역 

페이지 캐시에 대해서 다룬 내용과 같이 매번 디스크 요청을 통해서 디스크를 읽는 행위는 비효율적이므로 페이지 캐시를 사용한다하였다.
즉, 캐시 영역은 이 페이지 캐시가 할당된 영역이라고 봐도 된다.

그렇다면 buff는 무엇을 나타낼까? 이 영역은 버퍼 캐시 혹은 버퍼 영역이라고도 부르며, **블록 디바이스가 가지고 있는 블록 자체에 대한 캐시**이다.
사실 이 개념은 페이지 캐시도 동일하다. 커널 2.2 이전에는 두 영역이 분리되어있었지만 합치게 되면서 대부분 페이지 캐시가 담당하는 역할이 되었다.

그럼에도 아직까지 버퍼 영역을 사용하는 부분이 있는데 아래의 그림을 잠깐 보자.

<p align="center">
    <img src="https://i.imgur.com/DnIcuIh.png">
</p>
<p align="center">
    <em><a href="
https://lwn.net/Articles/736534/">그림 13.The bio layer, LWN.net, 2017</a></em>
</p>

보면 bio layer라는 추상화 계층이 껴있는 점을 볼 수 있다. 잠깐 위에서 보았던 페이지 캐시의 시각화 그림을 보자.

<p align="center">
    <img src="https://i.imgur.com/eDm8R8E.png">
</p>
<p align="center">
    <em><a href="https://cs4118.github.io/www/2023-1/lect/21-linux-mm.html#page-cache-visualized">그림 10. Page Cache Visualized, COMS W4118 Operating Systems 1 - Columbia univ, 2023</a></em>
</p>

보면 결국에는 `struct inode` 라는 값으로 관리가 되어지는 점을 볼 수가 있는데 실제 디스크에 쓰이게 될 경우에는 `struct bio` [^14] 라는 구조체로 변환되서 bio layer를 통해서 쓰여지게 된다.

그런데, super block[^15]이나 inode block[^15] 과 같이 파일 시스템을 관리하기 위한 메타 데이터를 읽어올 경우에는 `struct bio` 를 사용하지 않고, 다이렉트로 디바이스 드라이버와 통신하여 디스크에 데이터를 읽어와서 페이지 캐시에 파일 내용을 채우게 된다. 

<p align="center">
    <img src="https://i.imgur.com/s4CWITK.png">
</p>
<p align="center">
    <em><a href="https://www.yes24.com/Product/Goods/44376723">그림 14. 커널에서 사용하는 Page Cache와 Buffer Cache의 관계도, DevOps와 SE를 위한 리눅스 커널 이야기(강진우 저), 2017</a></em>
</p>

즉, 페이지 캐시에서 데이터를 핸들링 하는 구조체는 `struct inode` 로 캐시 영역이나 버퍼 영역이든 동일한 구조체를 사용하지만 디스크 I/O 발생 시에 접근하는 영역에 따라 다른 구조체를 사용하는 것이다.

### STEP 2.1.2 avaliable 지표 

위에서 캐시 영역과 버퍼 영역에 대해서 알게되었는데 `avaliable` 은 왜 이 두 영역을 제외한 가용 영역을 보여주게 되는 걸까?

![](https://i.imgur.com/ddqF2a0.png)

이는 스왑관련하여 포스팅했을 때 사용했던 그림이다. 그때도 말했던 것처럼 리눅스 커널 자체는 메모리가 놀고 있는 것을 싫어하므로 다수를 캐시 영역으로 활용한다.
위의 흐름을 보면 **메모리가 부족할 경우 점점 캐시 영역을 반환하고 실제 메모리 할당을 늘리는 모습**을 볼 수 있다.

즉, `avaliable` 에서 `buff/cache` 부분을 포함하고, 계산하는 이유는 **어차피 반환될 영역**이기 때문이다.
다시 `free` 명령어를 보자.

```sh
ubuntu@ubuntu:~$ free -m
               total        used        free      shared  buff/cache   available
Mem:            3911         129        3571           4         210        3632
Swap:           3910           0        3910
```

여기서 보면 단순히 $free + {buff}/{cache} \neq avaliable$  임을 볼 수 있는데 `avaliable`은 `buff/cache` 지표 중에서 즉시 반환될 수 있는 영역의 합이라 보면 된다.

## STEP 2.2 /proc/meminfo 명령어 분석 

위에서는 `free` 에 대해서 다뤄봤었다.`free` 는 명령어 자체가 가용 메모리의 용량을 볼 수 있는 것에 초점이 맞춰져있어서 각 메모리가 시스템의 어느 부분에 사용되는지는 볼 수가 없다.
이를 확인하기 위해서는 `/proc/meminfo` 명령을 사용하면 된다.

```sh
ubuntu@ubuntu:~/example$ cat /proc/meminfo
MemTotal:        4005008 kB
MemFree:         3651072 kB
MemAvailable:    3715564 kB
Buffers:           11096 kB
Cached:           180804 kB
SwapCached:            0 kB
Active:           100212 kB
Inactive:         123088 kB
Active(anon):        568 kB
Inactive(anon):    43260 kB
Active(file):      99644 kB
Inactive(file):    79828 kB
...
SwapTotal:       4004860 kB
SwapFree:        4004860 kB
Dirty:                 0 kB
...
Slab:              59648 kB
SReclaimable:      24508 kB
SUnreclaim:        35140 kB
...
```

모든 지표는 다루지 않고 중요한 지표만 몇개 다루고자 한다.

+ `SwapCached` : 스왑-아웃으로 스왑영역에 있다가 다시 스왑-인으로 캐시 영역으로 돌아온 영역
+ `Active(anon)` : MMIO에 대해서 파일 매핑된 영역이 아니라 익명 매핑된 영역에 대해서 나타내며, 위에서 LRU/2에서 본 활성 리스트라고도 봐도 무방하다. (따라서, 스와핑의 대상이 아님)
+ `Inactive(anon)` : 이 경우에는 비활성 리스트라고 보면되고, 스와핑이 발생할 수 있다.
+ `Active(file)` : MMIO 중에 파일 매핑된 케이스를 나타낸다. 위에서 본 `buff/cache` 영역이 여기에 속하며, 활성 리스트에 속한 데이터다. (따라서, 스와핑의 대상이 아님)
+ `Inactive(file)` : 위와 동일하며 차이는 비활성 리스트에 속해있고, 스와핑이 발생할 수 있다. 
+ `Dirty` : 위에서 페이지 캐시 쓰기 방식을 다룰 때 더티 페이지를 얘기했는데 `Dirty` 메모리는 그 과정에 사용하는 영역이다. 

이전 포스팅에서 `malloc()` 을 통한 예제를 다뤘었는데 `malloc()` 은 또한 익명 매핑을 활용한다고 얘기하였다. 

> 💡 이제는 왜 malloc()이 익명 매핑을 활용하는 것인지 이해가 될 것이다. (이해가 안간다면 다시 서론부터 보고 오자.)
> 서론을 보기 싫다면 설명을 해보겠다. 그 이유는 heap 영역 자체가 익명 매핑으로 되어있기 때문이다.
> malloc()은 힙 영역의 메모리 할당을 늘리는 것이므로, 프로그램 브레이크를 늘리는 식으로 메모리 할당을 할 것이다. 따라서, malloc()은 익명 매핑 기반이다. 

이제 실제 `/proc/meminfo` 값을 모니터링 해보자.
+ 익명 매핑을 활용한 `mmap` 예제 코드

```c
#include <sys/mman.h>
#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>

int main() {
    void *myblock = NULL;
    int count = 0;

    while(1) {
		myblock = mmap(NULL, 1024 * 1024, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
		
		if(myblock == MAP_FAILED) {
			return 1;
		}
		
		printf("Currently allocating %dMB \n", (++count));
		sleep(1);

		if (count == 10) {
			break;
		}
    }
    
    sleep(600);
    exit(0);
}
```

책에서는 이전 포스팅에서 다룬 예제 코드(`malloc`)을 활용하지만,  캐시 웜업이 안되서인지 드라마틱하게 `Active(anon)` 이 증가하는 모습을 재현할 수가 없었다.
따라서, `mmap()` 을 통해 강제로 익명매핑을 수행하는 식으로 짰고, LRU 정책에서 봤듯이 초기에는 비활성 리스트에 들어간 뒤 활성 리스트로 변경되어서 똑같은 코드를 여러번 돌려서 올리는 식으로 진행하였다.

```sh
root@ubuntu:~# cat /proc/meminfo | grep  anon
Active(anon):         88 kB
Inactive(anon):    59268 kB
root@ubuntu:~# cat /proc/meminfo | grep  anon
Active(anon):        104 kB
Inactive(anon):    62788 kB
root@ubuntu:~# cat /proc/meminfo | grep  anon
Active(anon):        116 kB
Inactive(anon):    67092 kB
root@ubuntu:~# cat /proc/meminfo | grep  anon
Active(anon):        124 kB
Inactive(anon):    71356 kB
```

조금씩 증가하는 모습을 볼 수 있다. 책에서는 (`x86_64`) 아키텍처에서 테스트를 하는 것 같은데 필자는 `arm64` 아키텍처에 돌려서 그런지 드라마틱하게 재현이 안된거같은데 이 부분은 좀 더 확인해봐야할거 같다. 이렇게 활성 <-> 비활성 리스트를 관리하는 작업은 `kswapd` 데몬이 관리해준다

## STEP 2.3 slab 메모리 영역

### STEP 2.3.1 vmalloc()과 kmalloc()

위에서 `buff/cache` 영역과 `anon` 에 대해서 알아보았다. 또 중요한 메모리 영역이 존재하는데 바로, **커널이 내부적으로 사용하는 영역**이다.

커널 또한 프로세스의 일종이기 때문에 메모리가 필요하며, 조금 특별한 방법으로 메모리를 할당 받아서 사용한다. 

<p align="center">
    <img src="https://i.imgur.com/Bh2GsmL.png">
</p>
<p align="center">
    <em><a href="https://www.pf.is.s.u-tokyo.ac.jp/wp-content/uploads/2018/10/AdvancedOperatingSystems3.pdf">그림 15. Low-Level Memory Allocatort, Advanced Operating Systems
#3(Shinpei Kato, The University of Tokyo), 2018</a></em>
</p>

위 그림은 커널 내 메모리 관리시스템을 추상화해놓은 그림이다.
우리는 현재까지 유저 공간 메모리 관리와 관련되어서 이야기를 해왔었다.

`Slab`을 이해하기 위해서는 커널 공간 메모리 관리(그림에서 **Kernel Dynamic Memory Allocation**)에 대해서 이해할 필요가 있다.

우리가 위에서 살펴본 내용처럼 커널은 메모리를 페이지 단위로 관리하고, 그림에서 보이듯 버디 시스템(Buddy System)[^16] 을 활용하여 물리 메모리 할당/해제 등을 처리한다.

위에서 언급한 내용처럼 Kernel Dynamic Memory Allocation만 보면 아래와 같이 나눠진다. 

+ Slab Allocator(`kmalloc()`) 
	+ 위에서 살펴봤던 내용 중에 `Lowmem` 에 대한 할당과 관련이 되어있다. MMU에 의해서 가상 주소로 변환된 물리적 주소를 리턴한다. 
	+ 바로 리턴할 수 있는 이유는 위에서 보았듯 선형 매핑(Linear Mapping)이 된 영역이라 가상 주소 공간 <-> 물리 메모리 주소가 1:1 매핑이 되어있고, 연속적이기 때문이다. 

+ `vmalloc()` 
	+ `Highmem` 과 연관되어있으며 간접 매핑(Indirect Mapping)으로 이뤄진 영역이다. 
	+ 따라서, 불연속적인 공간이 할당이 이뤄지고 `vmalloc()`은 그것을 대응하기 위한 함수이다.

그림을 보면 `kmalloc()` 은 연속적이고, 선형으로 매핑된 공간에 대한 처리를 위한 함수인데 **이것을 Slab Allocator가 사용**한다.

위에서 잠깐 `Highmem` 내용을 다룰 때, `kmap()`, `kunmap()` 함수를 다뤘었는데 이 둘의 차이는 링크로 대체해본다.
+ [영구커널매핑(kmap) 관련 질문](https://kldp.org/node/137435) (마지막 댓글을 보면 될 것 같다.)

### STEP 2.3.2 Slab

Slab은 무엇이길래 따로 이런식으로 관리를 해주는 것일까? 

커널도 일종의 프로세스이기 때문에 메모리를 관리를 해주어야하는데 버디 시스템에서는 기본적으로 `4KB` 크기로 페이지를 할당해준다. 
하지만 이 크기는 커널 입장에서는 큰 단위이고, 커널 입장에서는 이 정도의 영역이 필요없다. 

이렇게 큰 영역을 할당 받아서 커널이 사용하게 되면 단편화(Fragmentation)[^16] 현상도 발생할 수 있다. 이에 별도로 관리한다. 

**즉, `Slab`은 메모리 영역 중 커널이 직접 사용하는 영역이라고 볼 수 있으며 페이지 단위로 관리되기에는 단편화 문제 등이 발생할 수 있기 때문에 `Slab` 영역으로 따로 관리하는 것이다.**

이 `Slab` 은 `cat /proc/meminfo` 를 통해서 확인할 수 있다. 

```sh
Slab:              59648 kB
SReclaimable:      24508 kB
SUnreclaim:        35140 kB
```

위에서 나타나는 `Slab` 영역이 바로 그 영역이다.

+ `Slab` : 메모리 영역 중 커널이 직접 사용하는 영역 (`dentry cache, inode cache` 등이 존재) 
+ `SReclaimable` : 영역 중 재사용될 수 있는 영역이다. (Slab 영역에도 캐시가 존재하는데 주로 그러한 캐시들이 여기에 속한다.)
+ `SUnreclaim` : 영역 중 재사용될 수 없는 영역이다. (커널이 현재 사용중인 영역이며, 해제해서 다른 용도로 사용할 수 없다.)


해당 영역에 할당 정보를 자세히 보고 싶다면 `slabtop -o` 명령어를 통해서 볼 수 있다.

```sh
 Active / Total Objects (% used)    : 607979 / 698801 (87.0%)
 Active / Total Slabs (% used)      : 22439 / 22439 (100.0%)
 Active / Total Caches (% used)     : 98 / 147 (66.7%)
 Active / Total Size (% used)       : 150031.97K / 161972.25K (92.6%)
 Minimum / Average / Maximum Object : 0.02K / 0.23K / 8.00K

  OBJS ACTIVE  USE OBJ SIZE  SLABS OBJ/SLAB CACHE SIZE NAME
202020 167860  83%    0.10K   5180       39     20720K buffer_head
120204 113288  94%    0.19K   5724       21     22896K dentry
 75310  72998  96%    0.02K    443      170      1772K numa_policy
 62118  24756  39%    0.04K    609      102      2436K ext4_extent_status
 52542  50402  95%    1.15K   1946       27     62272K ext4_inode_cache
 35008  34889  99%    0.06K    547       64      2188K vmap_area
 33120  32432  97%    0.12K   1035       32      4140K kmalloc-128
```

여기서 `kmalloc-128` 같은 것이 `Slab` 의 크기를 나타낸다. `kmalloc-128` 이면 `kmalloc(128)` 과 같이 호출하면 최소 페이지인 단위인 `4KB`가 아닌 `kmalloc-128` 캐시를 이용하여 128만큼 할당해준다. 그림으로 보면 아래와 같이 되어있다고 보면 될 것이다.


<p align="center">
    <img src="https://i.imgur.com/D8yEJRR.png">
</p>
<p align="center">
    <em><a href="https://www.yes24.com/Product/Goods/44376723">그림 16. slab 할당자의 메모리 사용 개념도, DevOps와 SE를 위한 리눅스 커널 이야기(강진우 저), 2017</a></em>
</p>

이 중에서 `dentry cache` 와 `inode cache` 는 `slabtop -o` 명령어로 나타난 리스트 중에서 아래의 내용을 나타낸다.
+ `dentry` : 디렉토리의 계층 관계를 저장해둔다.
+ `ext4_inode_cache` : 파일의 inode에 대한 정보를 저장해둔다.

그리고 `Slab` 또한 `free` 명령어 사용 시에 `used` 영역으로 계산된다. (`buff/cache` 가 아니다.)

따라서, **사용하는 메모리 영역을 모두 더하고도 `used`와 맞지 않을 경우 `Slab` 누수를 의심**할 수 있다.

## STEP 3. 결론 

리눅스 커널 메모리 관리에 대해서 많은 것을 공부하였다.

1. 리눅스 프로세스의 기본 단위인 `task_struct` 의 동작원리 이해
2. 실제 가상 주소 공간을 통해서 메모리 할당과 관련되어있는 `mm_struct` 에 대한 정보 
	+ 이를 토대로 프로세스마다 스택, 힙, 데이터 영역이 어떤 식으로 관리되는지도 보았다. (실질적인 관리는 `vm_area_struct` 로 된다는 것도 말이다.)
3. 실제 `mm_struct` 내에서 관리되는 가상 메모리 영역(VMA)에 대한 데이터 구조체 `vm_area_struct` 의 동작원리 이해 
	+ 파일 매핑, 익명 매핑 등과 같이 실제 스택, 힙, 데이터 영역에 대한 관리에 대한 이해 
 
위에는 이제 우리가 기본적인 메모리 관리를 이해하기 위한 필수적인 구조체들을 보았던 내용이다. 

그 이후에는 아래와 같은 것들을 보았다.

1. 물리 메모리 공간 <-> 가상 주소 공간 사이의 실질적인 매핑 매커니즘 
2. 페이지와 페이지 캐시의 개념과 실제 코드를 통한 구조체 내용 
3. 페이지 캐시 관리 정책 등 

이 후 실제, 예제 코드를 통해서 `free` 명령어와 `cat /proc/meminfo` 를 통해서 세부 지표를 확인해보았다. 

## STEP 4. 추신

책 내용을 처음 보았을 때 혼동하였던 부분은 LRU 캐시 정책을 따를 경우, 초기 페이지가 활성 리스트에 넣어진다고 혼동하였다.
이에 혼동되는 부분에 대해서 저자님께 문의를 드렸었는데 아래와 같이 답변이 왔다.

![](https://i.imgur.com/cxTVKuo.png)

사실 어떻게보면 필자같은 사람의 이메일을 무시할 수 있었을 수도 있다고 본다. 
더군다나 필자는 문의 이메일을 금요일 오후쯤에 보냈었는데 해당 내용에 대해서 내용을 주고 받고, 정리된 회신(위 사진)을 토요일날 주셨다.

사회초년생인 필자의 혼동되는 부분에 대해서 평화로운 주말에 확인해주셨고, 정성스러운 피드백을 받았다.
진우님의 자세에 대해서 많은 생각을 하게되었다. **"앞으로 내가 가져야할 자세가 아닐까?"** 라는 생각도 하게 되었다. 

대한민국에는 필자가 존경하는 개발자들이 많다. 유명한 개발자 분들도 존경하는 분들도 있지만 필자보다 나이가 어린 개발자 중에서도 존경하는 사람이 있다.
필자가 존경하는 사람들의 공통점은 **나이, 경력을 막론하고 어떠한 사람이 궁금한 점을 제시하면 이에 대해서 자신의 지식 내에서 끝내는 것이 아니라 같이 탐색한다는 점**이다. 

얼마전까지 전세계의 뜨거운 감자는 초전도체였다.
어떻게 보면 가능성과 신뢰도가 낮은 작은 논문이 아카이브에 올라온 후 전세계 과학자들이 열광하였다. 

초전도체는 지금 현재는 소강상태에 접어든 것 같다. 물론, 이게 진짜냐 가짜냐가 아니라 잠시 뜨거웠던 가슴을 가라앉히고 냉정한 이성으로 판단하는 시점으로 페이즈가 옮겨갔다고 생각한다.
초전도체가 뜨거운 감자였을 때 생각해보면, 전세계 지식인들이 회의적인 반응을 가졌음에도 해당 연구를 하는 연구자분들은 검증을 위한 실험을 하였다. 

진짜인지 아닌지에 대한 검증을 떠나서, 해당 논문이 가능성과 신뢰도가 낮은걸 떠나서 만일 실재한다면 인류는 또다시 도약을 할 수 있기때문에 자신들의 리소스를 사용했다고 생각한다.
이것이 필자가 존경하는 사람들이 가진 자세라고 생각한다. 사실, Computer Science라는 분야 자체가 타 공학에 비하면 나온지 얼마안됐고 빠르게 변화한다.

그렇기에 이러한 자세를 유지하는 것이 중요하다고 본다. 나이, 경력을 막론하고 어떠한 지식에 대해서 궁금증을 타인이 물어보면, 적극적으로 같이 연구하여 검증하는 자세 말이다. 
필자도 이러한 자세를 갖기 위해서 부단히 노력을 해야겠다 생각한다.



# 레퍼런스 

1. [Linux Memory Management,  COMS W4118 Operating Systems 1](https://cs4118.github.io/www/2023-1/lect/21-linux-mm.html)
2. [System Calls,  COMS W4118 Operating Systems 1](https://cs4118.github.io/www/2023-1/lect/09-syscalls.html)
3. [Processes, Linux Kernel Labs](https://linux-kernel-labs.github.io/refs/heads/master/lectures/processes.html)
4. [Linux Kernel task_struct structure, Aiden](https://41d3n.xyz/272)
5. [리눅스의 태스크 모델, 'task_struct' 자료구조, jinh2352](https://velog.io/@jinh2352/Linux-5-%EB%A6%AC%EB%88%85%EC%8A%A4%EC%9D%98-%ED%83%9C%EC%8A%A4%ED%81%AC-%EB%AA%A8%EB%8D%B8)
6. [리눅스 페이지 캐시와 버퍼 캐시, 강진우님](https://brunch.co.kr/@alden/25)
7. [The Maple Tree, A Modern Data Structure for a Complex Problem, Oracle Linux Blog](https://blogs.oracle.com/linux/post/the-maple-tree-a-modern-data-structure-for-a-complex-problem)
8. [리눅스 커널의 mm_struct / vm_area_struct 구조체, BlackStar](https://showx123.tistory.com/92)
9. [Linux – vm_flags vs vm_page_prot, iTecNote](https://itecnote.com/tecnote/linux-vm_flags-vs-vm_page_prot/)
10. [Reverse mapping of anonymous pages in Linux, Sobyte](https://www.sobyte.net/post/2022-08/linux-anonymous-pages-reverse-mapping)
11. [[Linux Kernel] 주소와 메모리 공간, Endless Learning](https://hyeyoo.com/95)
12. [Cache, Linux Kernel Admin Guide](https://docs.kernel.org/admin-guide/device-mapper/cache.html)
13. [Page Cache eviction and page reclaim , Viacheslav Biriukov](https://biriukov.dev/docs/page-cache/4-page-cache-eviction-and-page-reclaim)
14. [[Linux] Slab 메모리 줄이기, Pangyoalto](https://pangyoalto.com/reduce-slab-memory/)

[^1]: [Virtual address space, Wikipedia](https://en.wikipedia.org/wiki/Virtual_address_space)
[^2]: [Process Control Block, Wikipedia](https://en.wikipedia.org/wiki/Process_control_block)
[^3]: [Program Break, Stackoverflow](https://stackoverflow.com/questions/6338162/what-is-program-break-where-does-it-start-from-0x00)
[^4]: [Page Table, Wikipedia](https://en.wikipedia.org/wiki/Page_table)
[^5]: [Traslation Lookaside Buffer(TLB), Wikipedia](https://en.wikipedia.org/wiki/Translation_lookaside_buffer)
[^6]: [Red-Black Tree, Wikipedia](https://en.wikipedia.org/wiki/Red%E2%80%93black_tree)
[^7]: [Maple Tree, Kernel Core API](https://docs.kernel.org/core-api/maple_tree.html)
[^8]: [Memory Areas, Kernel Admin Guide](http://books.gigatux.nl/mirror/kerneldevelopment/0672327201/ch14lev1sec2.html)
[^9]: [Page Table Management](https://www.kernel.org/doc/gorman/html/understand/understand006.html)
[^11]: [Page, Wikipedia](https://en.wikipedia.org/wiki/Page_(computer_memory))
[^12]: [Page Cache, Wikipedia](https://en.wikipedia.org/wiki/Page_cache)
[^13]: [Cache Replacement Policies](https://en.wikipedia.org/wiki/Cache_replacement_policies)
[^14]: [struct bio, Github](https://github.com/torvalds/linux/blob/master/include/linux/blk_types.h#L264)
[^15]: [Unix File System](https://en.wikipedia.org/wiki/Unix_File_System#Design)
[^16]: [Fregmentation](https://en.wikipedia.org/wiki/Fragmentation_(computing))