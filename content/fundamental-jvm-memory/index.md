---
title: "Fundamental of JVM and Memory and GC - Java JVM과 메모리 그리고 GC의 동작 과정 이해"
date: 2023-07-16 03:45:00 +0900
tags:
  - Java
  - JVM
  - Core
emoji: 💻
author: 개발한입
categories: 개발
---

```toc
```

# 목차
- 개요
- STEP 1. 자바 메모리 관리
- STEP 2. 메모리 영역
    - STEP 2.1 스택 영역
    - STEP 2.2 힙 영역
    - STEP 2.3 번외) 레퍼런스 타입 사용 주의사항
- STEP 3. 실행 엔진 
    - STEP 3.1 GC
      - STEP 3.1.1 Garbage Collections roots
    - STEP 3.2 식별 알고리즘
      - STEP 3.2.1 스탑-더-월드
      - STEP 3.2.2 레퍼런스 카운팅
    - STEP 3.3 정리 알고리즘
        - STEP 3.3.1 기본 정리 알고리즘
        - STEP 3.3.2 압축-정리 알고리즘
        - STEP STEP 3.3.3 복제-정리 알고리즘
    - STEP 3.4 GC 알고리즘 중간 정리 
    - STEP 3.5 Generational Algorithm 
    - STEP 3.6 Heap의 구조와 GC의 기본 동작 
- STEP 4. 메서드 영역(메타스페이스 영역)
  - STEP 4.1 자바 8 이전과 이후의 메서드 영역
  - STEP 4.2 메서드 영역에서의 GC 동작
- STEP 5. 가비지 수집기
  - STEP 5.1 Serial GC
  - STEP 5.2 Parallel GC
  - STEP 5.3 CMS(Concurrent Mark & Sweep) GC
  - STEP 5.4 G1(Garbage First)GC
- STEP 5. 결론
- STEP 6. 레퍼런스 및 참고자료

# 개요

<p align="center">
    <img src="https://i.imgur.com/Mll9lyu.png">
</p>
<p align="center">
    <em>그림 1. JVM 구조도</a></em>
</p>


위 그림은 전반적인 JVM의 구조를 나타내는 그림이다. 클래스로더 시스템에 대해서는 이전에 [한번 다뤘으니](https://brewagebear.github.io/fundamental-jvm-classloader/), 이 포스팅의 중점은 메모리 영역(Runtime Data Areas)와 실행 엔진(Execution Engine) 부분이라고 볼 수 있을 것 같다.

예전에 한번 GC 알고리즘에 대해서 다루고자 한다 했는데 너무 시간이 지났다. 그래서 이왕 시간이 많이 지난거 한번에 모든 걸 담아보면 어떨까? 라는 생각으로 글을 작성하였고, 이 때문에 장문의 글이 되어버렸다. 거기다가 최신 GC인 ZGC는 내용의 압박으로 인하여 일단 패스했는데 만약 추가하게 되면 개요에 추가하도록 하겠다.

추가로 이번 내용의 대부분은 아래의 책들을 참고하였다.

1. [Java Performance Fundamental, 김한도 저, 2009](https://www.yes24.com/Product/Goods/3577335)

2. [Java Memory Management: A comprehensive guide to garbage collection and JVM tuning, Maaike van Putten, 2022](https://a.co/d/3vI0AU4)

특히, Java Performance Fundamental은 10년이 지난 지금에도 바이블이라고 생각한다. 이 책을 꼭 읽어보기를 추천한다. 

주의할 점은 이 책이 나온 시점에는 Java 1.5 ~ 1.6 시절이므로 그걸 감수하면서 달라진 내용을 팔로우하면서 봐야한다는 점이다. Java Memory Management라는 책 또한, 볼륨이 상대적으로 적은데 (대략 220쪽분량) 핵심적인 내용들과 내가 궁금한 부분들에 대해서는 전부 다 녹여져 있었다.

이 두 권을 추천하며, 추가적으로 JVM에서 더 넓은 범위의 성능 최적화를 공부하고 싶다면 [실무로 배우는 시스템 성능 최적화, 권문수 저, 2022](https://www.yes24.com/Product/Goods/115426829) 이 책을 추천한다. 

자 이제 본론으로 들어가보자.

## STEP 1. 자바 메모리 관리

이 메모리 영역은 자바가 동작할 때 사용되는 모든 것들이 올라가지게 된다. JVM의 **주된 역할 중 하나도 이 메모리 영역(Runtime Data Areas)를 관리**하는 것이다.

JVM이 이 영역을 관리를 하지 않게 되면, 메모리 라이프 사이클 관리와 같은 활동이 수행되지 않을 것이고 이는 OOM과 같은 문제를 발생시킬 수 있다. 

즉, JVM은 이 메모리 영역에 대한 라이프 사이클을 관리하여 프로그래머가 해당 부분에 노력을 기하지 않더라도 자동으로 관리하는 편의성을 가져왔다.

위에서는 설명한 바와 같이 JVM은 이 메모리 영역에 대한 "라이프 사이클"을 책임져준다. 이는 자바 이전의 프로그래밍 언어들(`C, CPP`)은 프로그래머가 스스로 메모리 관리를 했어야했다는 점이다.

학부생때 `C, CPP` 와 같은 프로그래밍 언어를 다뤘다면 `malloc` 이나 `free` 등을 사용해서 메모리 관리를 한 적이 있을 것이다. 이 언어들은 메모리 영역에 대한 관리를 프로그래머 스스로가 책임을 졌었다.
이는 아래와 같은 문제점을 낳았다.

1. 댕글링 포인터(Dangling Pointer)[^1] : 포인터가 여전히 메모리가 해제된 영역을 가르키고 있는 상황
2. 메모리 릭(Memory leaks) : 더 이상 필요하지 않은 메모리에 대해 할당 해제가 제대로 이뤄지지 않는 상황이 누적되어서 메모리가 고갈되어 부족해지는 상황
3. 보일러플레이트 코드(Boilerplate code) : 코드에 비즈니스 로직보다 메모리 할당과 해제에 대한 코드가 더 많이 자리 잡게되고, 이 코드를 지속적으로 유지보수 해야했음
4. 오류 발생 가능성(Error-prone) : 숙련된 개발자라 하더라도 이러한 작업에 대해서 실수가 발생할 가능성이 존재 

자바는 JVM의 메모리 기능을 활용하여 위와 같은 문제를 프로그래머가 더 이상 고민하지 않고, 비즈니스 로직에 전념할 수 있도록 하였다.
그렇다면, 이러한 기능은 어떤식으로 이뤄질 수 있을까?

핵심은 위 그림의 세가지 구성요소이다. 

1. 클래스로더 시스템(ClassLoader System) : 초기 바이트 코드 검증 및 클래스 파일을 실제로 로드되기 위해 필요한 구성요소
2. 메모리 영역(Runtime Data Areas) : 클래스의 로딩과 바이트 코드의 실행은 메모리를 필요로 하는데 이러한 작업들을 수행하는 구성요소
3. 실행 엔진(Execution Engine) : 클래스로더를 통해서 로드된 클래스들이 메모리에 적재되면 실제 바이트 코드를 실행하는 구성요소

아마 대충 러프한 플로우는 이해가 됐을 것이다. 자세한 부분은 [OpenJDK - Github](https://github.com/openjdk/jdk/blob/master/src/hotspot/share/runtime/init.hpp#L38) 해당 코드를 참고해보자.

 `init_globals()` 메서드를 통해서 준비 과정을 거치면서 `Main Java Thread` 를 구성하고, `vm_init_globas()` 메서드를 통해서 `VM Thread` 를 구성하는 헤더파일이다. 요즘 깃허브가 좋아져서, 클릭하면서 해당 내용을 참고할 수 있으니 내부 로직을 상세히 보고 싶으면 해당 깃허브를 참고해보자.

추가로 앞으로 기술할 모든 내용은 **Hospot VM**[^2] 기준이다. 

우리는 대충 JVM이 어떠한 역할을 하는지와 실제 자바 코드가 어떤식으로 처리되고, 구성요소는 어떤 식으로 동작하는 지 배웠다.
앞서서 말했듯이 이번에 주요하게 볼 내용은 메모리 영역과 실행엔진 부분이므로 이 두 컴포넌트의 상세한 내용을 확인해보자. 

## STEP 2. 메모리 영역

<p align="center">
    <img src="https://i.imgur.com/UtkS6yx.png">
</p>
<p align="center">
    <em>그림 2. JVM 메모리 영역 구조도</a></em>
</p>


이미 위에서 보여줬던 그림처럼 메모리 영역은 5가지의 구성요소로 이뤄진다고 하였다. 
간략하게, 각 영역들이 어떠한 일을 하는지를 설명한 후에 세부적인 내용을 다뤄보고자 한다.

1. **스택 영역**

프리미티브 타입들과 힙 영역에 저장된 참조(Reference)에 대한 정보들이 담기는 영역이다.

메서드가 호출되면 스택 프레임(Stack Frame)이 생성되며, 각 프레임마다 메서드에 대한 값을 유지하고 있다. 스택 영역은 **각 쓰레드 마다 독립적인 공간이 할당**된다. 

2. **PC 레지스터**

운영체제에서 말하는 PC 레지스터와 상동한 일을 수행한다. 현재 실행 중인 명령의 주소를 저장함으로써 어떤 코드가 실행되는 지를 알게끔한다.
PC 레지스터는 **각 쓰레드 마다 독립적인 공간이 할당**된다.

3. **힙 영역**

JVM이 시작되면, RAM의 일부분을 어플리케이션의 메모리 동적할당을 위해서 예약한다고 위에서 말했었다. 이 영역이 해당 부분이라고 보면된다.

런타임 데이터들은 이 곳에 할당되며, 인스턴스들을 이 영역에서 찾을 수 있다. 
힙 영역은 GC를 통해서 메모리 할당, 해제등이 관리가 된다.

힙 영역은 **모든 쓰레드가 공유**한다.

4. **메서드 영역(메타스페이스 영역)**

클래스의 메타데이터인 런타임 코드, 정적 변수, 상수 풀 그리고 생성자 코드등을 포함한다.

메서드 영역은 **모든 쓰레드가 공유**한다.

5. **네이티브 메서드 스택 영역**

이 영역은 Java가 아닌 C와 같은 언어로 구현된 네이티브 코드가 실행되는 곳이고, 위에서 살펴본 스택처럼 네이티브 코드 또한, 명령에 대한 스택이 필요하므로 네이티브 코드를 위한 스택 영역이라고 보면 될 것이다.

이 영역 또한, **스택 영역과 같이 모든 쓰레드가 독립적인 공간**을 갖는다.

위 내용을 정리하면 아래와 같을 것이다.

| 영역 명                   | 특징                                                                              | 쓰레드 간의 공유 여부 |
| ------------------------- | --------------------------------------------------------------------------------- | --------------------- | 
| 스택 영역                 | 메서드가 호출될 때마다 스택프레임을 생성하며, 힙 영역에 대한 참조가 저장되는 공간 | X                     |
| PC 레지스터               | 현재 실행 중인 명령의 주소를 저장하는 역할                                        | X                     |
| 힙 영역                   | JVM이 메모리 동적할당을 위해서 예약을 해둔 공간으로 런타임 데이터들과 인스턴트들이 저장되는 공간 | O                     |
| 메서드 영역               | 클래스의 메타데이터인 런타임 코드, 정적 변수, 상수 풀 등을 저장하는 공간          | O                     |
| 네이티브 메서드 스택 영역 | 자바 코드가 아닌 네이티브 코드를 위한 스택을 사용하기 위한 공간                   | X                     |

이제 이 영역들에 대해서 세부적으로 보도록 하자.

### STEP 2.1 스택 영역

자바에서의 데이터 값은 크게 2가지 분류로 나뉘어진다.
1. 원시타입 값(Primitive value) : 이 값은 원시타입(int, char 등...) 중에서 하나의 타입을 갖고 있다.
2. 참조타입 값(Reference value) : 이 값은 객체 위치에 대한 참조 포인터를 지니고 있다. 

스택 영역을 이해하기 위해서는 이 2가지 값의 할당 방식에 대해서 이해를 할 필요가 있다. 

앞서 위에서 말한 것과 같이 스택은 각 쓰레드마다 별도의 영역을 갖고 있고, 쓰레드가 호출될 때마다 스택 프레임을 생성한다고 하였다.
그림으로 보면 아래와 같다고 볼 수 있다.

<p align="center">
    <img src="https://i.imgur.com/eeQ4ikC.png">
</p>
<p align="center">
    <em>그림 3. 쓰레드 별 스택과 스택프레임</a></em>
</p>

스택은 말 그대로 자료구조의 스택과 동일하게 후입선출(Last-In First-Out, LIFO)의 구조를 갖고 있다.
예를 들면 쓰레드 1번의 스택의 상황은 `a()` 메서드가 호출된 상황에서 다시 `b()` 메서드가 호출된 상황이라 보면 될 것이다.

스택 구조로 되어있기에 `b()` 의 결과를 다시 `a()` 에서 받아서 결과를 조합한 뒤에 결과를 도출할 수 있을 것이다.
쓰레드마다 스택 구조가 생기는 이유도 동일하다. 만약, 멀티쓰레딩 환경에서 스택 영역을 공유한다고 가정해보자. 

그러면 어떤 쓰레드에서 어떤 메서드가 끝났는지 파악하기도 매우 어렵고, 위 예시와 같이 `a()` 프레임은 `b()` 프레임의 결과를 받아 처리하는 것을 기대하는데, 다른 쓰레드들이 하나의 스택을 사용한다면
이 처리하는 것이 매우 까다로울 것이다. 따라서, 자바는 각 쓰레드마다 별도의 스택 영역과 PC 레지스터를 둔 것이다. 

그렇다면, 스택 프레임은 어떠한 구조로 되어있을까?

<p align="center">
    <img src="https://i.imgur.com/QrKNvwY.png">
</p>
<p align="center">
    <em>그림 4. 스택프레임 내부 구조도</a></em>
</p>


위와 같은 구조로 되어있으며, 스택 프레임의 구성요소는 크게 3가지이다.

1. 지역변수 배열(Local variable array) : 해당 스택 프레임의 지역 변수들을 담는 배열 
2. 피연산자 스택(Operand Stack) : 만약 프레임 내에서 지역변수 `x + y` 와 같은 연산을 수행할 시 그에 대한 피연산자인 `x`와 `y`를 저장해두는 공간
3. 프레임 데이터(Frame Data) : 메소드를 실행하는 데 필요한 데이터로 구성 되는 공간 

상세하게 하나씩 살펴보자.

#### STEP 2.1.1 지역변수 배열

지역변수 배열의 크기는 **컴파일 타임에 결정**되며, 이 배열에는 2가지 공간이 존재한다.
1. Single Spot : **int, short, char, float, byte, boolean, reference** 타입을 위한 공간
2. Double Spot : **long, double** 타입을 위한 공간

자바에서는 메서드가 2가지 타입이 존재하는 것은 다들 알고 있을 것이다.
1. 정적 메서드(static method) 
2. 인스턴스 메서드(instance method)

만약, 해당 프레임이 인스턴스 메서드를 통해서 생성된 것이면, 지역변수 배열의 첫번째 원소(index == 0)는 바로 `this`  즉, 메서드 호출했던 객체의 레퍼런스를 가르킨다.
정적 메서드의 호출로 생성된 경우에는 지역변수 배열의 0번째부터 지역변수들이 저장된다.

#### STEP 2.1.2 피연산자 스택

이 부분은 어셈블러같은 걸 다뤄봤으면 이해가 쉽다. 아래와 같은 자바코드가 있다고 가정해보자.

```java
// main.java
package test;

class Main {
	 public int test() {
		 int x = 1;
		 int y = 2;
		 return x + y;
	 }
}
```

단순한 메서드임을 확인할 수 있는데 이를 자바 컴파일러로 확인하면 아래와 같은 결과를 얻을 수 있다.

```sh
javac main.java # 자바 파일을 컴파일하여 바이트코드화
javap -c Main.class # 클래스 파일을 역어셈블하여 출력하는 명령 

Compiled from "main.java"
class test.Main {
  test.Main();
    Code:
       0: aload_0
       1: invokespecial #1                  // Method java/lang/Object."<init>":()V
       4: return

  public int test();
    Code:
       0: iconst_1
       1: istore_1
       2: iconst_2
       3: istore_2
       4: iload_1
       5: iload_2
       6: iadd
       7: ireturn
}
```

여기서 우리가 볼 내용은 `public int test();` 단의 어셈블러인데 `iconst_` 는 언더바 뒤에 상수를 피연산자 스택에 `push` 하는 명령이다.
즉, `0: iconst_1` 은 피연산자 스택에 `x` 의 리터럴인 1을 푸시하는 명령이다. `istore_` 는 언더바 뒤에 상수를 피연산자 스택에서 `pop` 하여 지역변수 배열에 저장하는 명령이다. 
즉, `1: istore_1` 은 피연산자 스택에 넣어진 1을 지역변수 배열의 인덱스 1에 저장한다. (인스턴스 메서드기 때문이다.) 이후 `iload_` 는 지역변수 배열의 인덱스를 읽어서 값을 읽는 연산이다.
이후 실제로 `iadd` 명령을 통해서 `x + y` 의 결과를 얻게 되는 것이다.

#### STEP 2.1.3 프레임 데이터

위에서 프레임 데이턴느 메서드를 실행하는 데 필요한 다양한 데이터로 구성된다고 얘기를 하였다. 

런타임 상수 풀(run-time constant pool)에 대한 레퍼런스, 일반 메서드 호출 완료(Normal Method Invocation Completion), 갑작스러운 메서드 호출 완료(Abrupt Method Invocation Completion) 등이 이 데이터에 대한 예시이다.

스택 프레임은 동적 링킹(Dynamic-Linking)[^3]을 지원하기 위해 현재 메서드 유형에 대한 런타임 상수 풀의 참조를 갖고 있다. 예시를 위해서 위의 코드를 좀 손을 봐보자.

```java
// main.java
package test;

class Main {
	 public int test() {
		 int x = 1;
		 int y = 2;
		 System.out.println("Hello World!");
		 return x + y;
	 }
}
```

이 코드의 역어셈블러 결과는 아래와 같다.

```sh
Compiled from "main.java"
class test.Main {
  test.Main();
    Code:
       0: aload_0
       1: invokespecial #1                  // Method java/lang/Object."<init>":()V
       4: return

  public int test();
    Code:
       0: iconst_1
       1: istore_1
       2: iconst_2
       3: istore_2
       4: getstatic     #2                  // Field java/lang/System.out:Ljava/io/PrintStream;
       7: ldc           #3                  // String Hello World!
       9: invokevirtual #4                  // Method java/io/PrintStream.println:(Ljava/lang/String;)V
      12: iload_1
      13: iload_2
      14: iadd
      15: ireturn
}
```

위에서 봤을 때랑 달라진 부분은 `#2, #3, #4` 로 주석쳐진 부분이다. 이 부분이 바로 런타임 상수 풀에 대한 참조를 처리하는 부분이다. 한 줄씩 봐보자.

1. `getstatic` 은  클래스의 정적 필드 값(`System.out == PrintStream`)을 가져와서 오퍼랜드 스택에 푸시한다. 
2. `ldc`를 통해서 상수 풀의 참조 값(`Hello World!` 상수의 참조 값)을 스택의 맨 위로 푸시한다.
3. `invokevirtual` 명령어를 수행한다.
	+ 현재, 오퍼랜드 스택의 탑에는 `Hello World!` 의 참조 값이 들어가 있다 이를 꺼내와서 `PrintStream.println()` 의 인자로 전달하여 새로운 프레임을 생성한다.
	+ 참조 값이 팝되었기 때문에 현재 탑은 `PrintStream` 일 것이다. 이를 다시 팝하여 위에서 처리된 인자들을 활용하여 화면에 출력한다.

이 뿐만 아니라 아까 위에서 적은 것 처럼 스택 프레임에는 `throws` 와 같은 예외 상황이나 정상 리턴에 대한 처리등이 포함된다고 하였다. 이는 실제로 바이트코드를 보면서 확인해보길 바란다.

위에서 상세하게 스택 영역의 구성요소들이 하는 일에 대해서 다뤄보았다.
하지만, 원시 타입과 정적 메서드에 대한 테스트로만 예시를 보여줬는데 그렇다면 스택과 힙 영역은 어떻게 연관되어지고, 실제 객체를 힙 영역에 저장할 때는 JVM에서 어떠한 일이 벌어지는 걸까?

### STEP 2.2 힙 영역

위에서는 스택 영역에 대해서 다뤘었다. 그렇다면, 실제 힙 영역의 객체는 어떤식으로 저장되는 것일까? 

아래와 같은 코드가 있다고 가정해보자.

```java
package test;

public Main {
	private class Person {
		private final String name;
		private final String address;

		public Person(String name, String address) {
			this.name = name;
			this.address = address;
		}
	}

	public void test() {
		Person person = new Person("bear", "Goyang-si");
	}
}
```

위 코드를 그림으로 나타내면 아래와 같을 것이다.

<p align="center">
    <img src="https://i.imgur.com/b4NZmnc.png">
</p>
<p align="center">
    <em>그림 5. 예시코드의 스택과 메모리 상황</a></em>
</p>


`test()` 메서드가 호출되면 프레임이 생길테고, 이때 우리는 해당 메서드 내부에서 `new Person("bear", "Goyang-si")` 와 같이 생성자를 전달하여 객체를 생성하였다. 

인스턴스가 생성되게 되면, 실제 값은 힙 영역에 저장되고 스택 내 지역변수는 해당 힙 영역에 생성된 값에 대한 레퍼런스를 갖고 있게 된다.

즉, `person` 이라는 **변수 자체는 실제 값을 들고 있는 것이 아니라 힙 영역에 할당된 데이터에 대한 참조 값을 들고 있는 것**이다.

위의 예시를 좀 더 우리가 자주 쓰는 자바 언어처럼 바꾸면서 스택 프레임과 힙 영역 할당 과정에 대해서 알아보자.

```java
package test;

public Main {
	private class Person {
		private final String name;
		private final String address;
		private final int age

		public Person(String name, String address, int age) {
			this.name = name;
			this.address = address;
			this.age = age;
		}

		public String introduce() {
			String template = "안녕하세요. 제 이름은 " + this.name + "이고, 사는 곳은 " + this.address + " 에 살고 있으며, 나이는 " + this.age + "입니다.";
			return template;
		}
	}

	public static void main(String[] args) {
		int x = 0;
		Person bear = new Person("bear", "Goyang-si", 29);
		System.out.println(x);
		System.out.println(bear.introduce());
	}
}
```

이제 예시가 좀 더 그럴싸해졌다. 그렇다면 스택 프레임의 구조는 어떻게 될까?

<p align="center">
    <img src="https://i.imgur.com/1x6ZWE8.png">
</p>
<p align="center">
    <em>그림 6. 예시코드의 스택과 메모리 상황</a></em>
</p>

위 스택 프레임을 분석하면 아래와 같이 분석할 수 있다.

1. `main()` 메서드가 호출됨에 따라 스택프레임이 생성된 후에 스택 영역에 푸시된다.
2. 스택 프레임 내에 `args, x` 값이 지역 변수 배열에 저장된다. (`x` 는 원시타입으로 별도 레퍼런스를 갖고 있지 않고, `main()` 메서드 내에 선언된 지역 변수라 따로 레퍼런스가 없다.)
3. 객체(`bear`)가 아래와 같은 과정으로 이뤄진다.
	+ 문자열 리터럴 2개 ("bear", "Goyang-si", 29)를 전달하여 `Person` 객체를 생성한다. 
		+ 문자열 리터럴은 `String` 객체이므로 힙에 저장되며, `String` 이기 때문에 특별한 공간인 **String Pool**에도 저장된다.
		+ `age` 의 경우에는 원시타입이므로 힙에 직접 저장이 된다.
		+ 그러나, 객체의 레퍼런스 값이 담기는 `bear` 변수는 `main()` 메서드 내에 저장된다.
4. 이후 `System.out.println(x)` 에 따라 `println()` 메서드의 새로운 프레임이 스택 영역에 푸시된다.
5. 추가로 `bear.introduce()` 메서드도 호출됨에 따라 이 프레임도 해당 스택 영역에 푸시된다.

이 과정을 끝낸 후에 위에서 우리가 바이트 코드를 분석했던 방식과 같이 프로그램이 동작할 것이다.

### STEP 2.3 번외) 레퍼런스 타입 사용 주의사항

우리는 스택 영역을 깊게 보면서, 스택과 힙 영역이 어떤 역할을 하는 지와 자바에서 객체들이 생성될 때 어떠한 과정으로 생성되는 지 등을 살펴보았다.
또한, 힙 영역에 우리가 사용할 객체가 생성되면 이 값은 레퍼런스를 토대로 참조를 하여 접근하는 식으로 동작하는 것을 알게되었다. 

이때, 자바의 특성이 레퍼런스 타입을 사용할 때는 위와 같이 동작을 하기 때문에 주의할 점이 존재한다.

이에 대해서 잠깐 설명을 해보고자 한다. 이를 위해 아래의 간단한 코드를 참고해보자.

```java
class NameBuilder {
	private StringBuilder name;
	
	NameBuilder(StringBuilder name) {
		this.name = name;
	}

	public StringBuilder get() {
		return this.name;
	}
}

public class Main {
	public static void main(String args[]) {
		StringBuilder first = new StringBuilder("test");

		NameBuilder nameBuilder = new NameBuilder(first);
		System.out.println(nameBuilder.get()); // test

		StringBuilder second = nameBuilder.get();
		second.append("test")
		
		System.out.println(nameBuilder.get()); // testtest
	}
}
```

이 코드의 작성자는 `NameBuilder` 라는 클래스에 `String` 을 인자로 받는 것보다 `StringBuilder` 를 인자로 전달받아서 보다 `append()` 작업등을 원할하게 하는 식의 작업을 생각했던 것 같다. 
그리고 `NameBuilder` 의 멤버변수 `name`은 접근제어자를 `private`으로 두는 등 얼핏보면 나름 잘짠 코드라고 보일 수도 있다.

그러나, 이 코드는 **캡슐화가 제대로 이뤄지지 않는다.** 우리는 `NameBuilder` 내부에 `StringBuilder` 가 `private` 이므로 바깥에서 접근도 안될 것이라 생각했지만 실제 코드를 동작해보면 옆에 주석을 달아둔 부분과 같이 `testtest`가 찍힘을 볼 수가 있다.

왜 이런 문제가 발생하는 것일까? 정답은 "**레퍼런스**"에 있다.
그림으로 확인해보자.

<p align="center">
    <img src="https://i.imgur.com/aDoI9xQ.png">
</p>
<p align="center">
    <em>그림 7. 예시코드의 스택과 메모리의 레퍼런스 상황</a></em>
</p>


`first` 와 `nameBuilder` 를 생성한 시기에 스택과 힙 영역을 보면 위 구조와 동일할 것이다. 

이제 `StringBuilder second = nameBuilder.get();` 이후에는 어떻게 변하는지 그림을 확인해보자.

<p align="center">
    <img src="https://i.imgur.com/9pa6JCy.png">
</p>
<p align="center">
    <em>그림 8. 변경된 코드에 의한 스택과 메모리의 레퍼런스 상황</a></em>
</p>


`nameBuilder.get()` 를 호출하게 됐을 때, 사실 상 `first`가 가르키는 곳과 동일한 레퍼런스를 참고하고 있으며, `second.append("test")` 를 하게 되면, 이는 같은 레퍼런스를 바라보고 있는 `nameBuilder` 의 `name` 에도 영향을 주고 말아 값이 변경되게 되는 것이다.

이러한 문제때문에 접근제어자를 `private`으로 두었다 해도, 캡슐화가 깨질수가 있는 것이다.
이 문제를 해결할 수 있는 방법은 무엇일까? 

아래와 같이 코드를 바꾸면 방법이 존재한다.

```java
class NameBuilder {
	private StringBuilder name;
	
	NameBuilder(StringBuilder name) {
		this.name = new StringBuilder(name.toString()); // 새로운 객체를 생성하여 전달
	}

	public StringBuilder get() {
		return new StringBuilder(name.toString()); // 새로운 객체를 생성하여 전달
	}
}

public class Main {
	public static void main(String args[]) {
		StringBuilder first = new StringBuilder("test");

		NameBuilder nameBuilder = new NameBuilder(first);
		System.out.println(nameBuilder.get()); // test

		StringBuilder second = nameBuilder.get();
		second.append("test")
		
		System.out.println(nameBuilder.get()); // test
	}
}
```


이 방식을 유식한 말로 방어적 복사 기법(Defensive copy)[^4] 이라 한다. 위에서 `get()` 을 호출하거나 생성자를 호출 할 때 `new StringBuilder` 를 통해서 아예 새로운 객체를 할당하여 리턴하는 것을 볼 수 있다. 이를 통해서 레퍼런스를 끊고, 올바르게 캡슐화를 시킬 수 있다. 

이러한 문제는 레퍼런스 타입에 발생한다고 얘기를 했는데 우리가 자주 사용하는 콜렉션 프레임워크인 `List, Map, Set` 등에도 발생할 수 있다.

따라서, 일급콜렉션[^5] 을 사용할 때도 위와 같은 방어적 복사 기법과 같이 불변 객체(`unmodifiableList` 와 같은)를 활용하기도 한다. 
이 내용에 대해서 좀 더 알고 싶으면, 깊은 복사(Deep Copy)[^6] 혹은 얕은 복사(Shallow Copy)[^6] 에 대해서 공부해보도록 하자.

## STEP 3. 실행 엔진 

<p align="center">
    <img src="https://i.imgur.com/NOlggKt.png">
</p>
<p align="center">
    <em>그림 9. 실행 엔진 내부 구조도</a></em>
</p>

위에서는 스택 & 힙 영역에 대해서 다뤘었다. 이제는 실행 엔진에 대해서 다뤄보고자 한다.
특히, 중점적으로 GC에 대해서 다룰 예정이다.

### STEP 3.1 GC

서두에서 자바는 `C, CPP`와 다르게 JVM 내에서 메모리를 할당하고 해제하는 등의 라이프 사이클을 관리해준다고 얘기하였다.
이 기능을 제공해주는 것이 바로 "GC" 이다. 

이제 GC가 어떤 매커니즘으로 동작하는지 알아볼 차례이다. 

#### STEP 3.1.1 GC Root Set

GC의 로직은 매우 간단하다. 

> "현재 힙과 메서드 영역에서 사용되지 않는 객체(Object)를 정리하는 것이다."

그렇다면, 이 사용유무는 어떻게 판별할까? 그것을 판단해주는 것이 바로 *"GC Root Set"* 이다.  

Root Set에서 어떤 식으로든 레퍼런스를 참고하고 있으면 ***접근가능한 객체(Reachable Object)*** 라 부르고 이를 현재 사용 객체라 판단한다. 

GC Root Set의 종류는 아래와 같다.
1. 스택 내 레퍼런스 정보 
2. JNI 레퍼런스 정보
3. 메서드 영역 내 로드된 클래스 중 클래스 정적 변수 및 상수 풀 레퍼런스 정보

위 세가지가 왜 GC 대상이 되면 안되는 지는 하나씩 설명해보도록 하겠다.

+ **스택 내 레퍼런스 정보**

스택 내 레퍼런스 정보는 엄밀하게 따지면, 현재 동작 중인 상황에서의 레퍼런스에 대해서라고 볼 수 있다. 

즉, 지역변수 배열이나 피연산자 스택 등에 레퍼런스 정보가 현재 존재한다면 이는 접근가능한 객체이므로, GC의 대상이 아니다. 

상식적으로 생각해보면 매우 쉬운데 정상적으로 어플리케이션이 동작 중인데 해당 레퍼런스가 GC의 대상이 된다면 아마도 수 많은 오류들을 마주하게 될 것이다. 

+ **JNI 레퍼런스 정보**

위에서 JNI에 대해서는 간략히 다뤘는데, 네이티브 호출을 한 후에 실제로 사용 중인지 확인을 해야될 것이다.  

스택 내 레퍼런스 정보와 마찬가지로 해당 객체를 네이티브 코드에서 사용 중인데 함부로 GC를 하게 된다면 많은 오류가 발생할 것이기 때문이다. 

따라서, JNI에 대한 레퍼런스 정보를 GC Root Set으로 사용하는 것이다. 

+ **메서드 영역 내 로드된 클래스 중 클래스 정적 변수 및 상수 풀 레퍼런스 정보**

메서드 영역에 대해서도 서두에서 간략하게 말했었다. 두 데이터 모두 클래스 수준의 데이터이며, 둘 다 클래스가 로드될 때 생성된 후에 클래스가 JVM 내에 로드된 상태로 유지되는 한 존재한다.

따라서, 두 데이터를 갖고 있는 클래스가 로드 되는 동안에는 GC의 대상이 되서는 안된다.

이는 후에 메서드 영역에 대한 GC를 다루면서 좀 더 다뤄보고자 한다.

> 위와 같은 세가지 레퍼런스 정보에 **직, 간접적**으로 참조되고 있다면 모두 접근가능한 객체이고, GC 대상이 아니라는 점을 명심하자.

이제, 실제 GC가 어떤 식으로 동작하는 지 알아보자.

### STEP 3.2 식별 알고리즘

아래의 코드가 주어진다 가정하고 스택 프레임을 그려보겠다.

```java
public class Member {
	private Long id;
	private String name;
	private int age;

	public Member(Long id, String name, int age) {
		this.id = id;
		this.name = name;
		this.age = age; 
	}
}

public class Main {
	public static main(String args[]) {
		Member member1 = new Member(1L, "bear", 29);
		Member member2 = new Member(2L, "rabbit", 28);
		Member member3 = new Member(2L, "tiger", 27);

		List<Member> members = List.of(member1, member2, member3);
	}
}
```

스택 프레임은 아래와 같이 그려질 것이다.

<p align="center">
    <img src="https://i.imgur.com/hhsbkF8.png">
</p>
<p align="center">
    <em>그림 10. 예시 코드의 스택과 힙의 레퍼런스</a></em>
</p>


만약 여기서 `member1 = null` 로 변경하면 레퍼런스가 아래와 같은 그림으로 변경될 것이다.


<p align="center">
    <img src="https://i.imgur.com/wWLztN9.png">
</p>
<p align="center">
    <em>그림 11. null로 처리된 후의 스택과 힙의 레퍼런스</a></em>
</p>


하지만, 여전히 `members` 의 레퍼런스는 `null` 로 변경된 `member1` 을 참조하고 있다.

이 부분이 바로 우리가 GC Root Set을 얘기할 때 나왔던 스택 내 레퍼런스 정보에 해당하는 예시라 볼 수 있다. 
현재, `member1` 의 직접적인 참조는 제거되었지만, `members` 가 해당 객체의 레퍼런스를 갖고 있으므로 간접적으로 접근이 가능하다.

즉, ***접근가능한 객체(Reacheable Object)*** 로써 `member1` 은 아직 GC의 대상이 아니다.

그렇다면 `members = null` 로 변경하게 되면 어떻게 될까?

<p align="center">
    <img src="https://i.imgur.com/r9OqVsE.png">
</p>
<p align="center">
    <em>그림 12. 접근불가능한 객체(Unreacheable Object)가 나타난 상황</a></em>
</p>


이런식으로 스택 프레임 내의 레퍼런스 정보가 변경될 것이다 더이상 접근할 수 없는 두 객체(Member Object, List Object)는 비로소 GC의 대상이 된다.

그렇다면, 궁금한 점이 생길 것이다. 

> 그렇다면, 지속적으로 접근가능한 객체인지 아닌지 판별을 해야될 것 같은데 이는 어떻게 처리가 되나요? 

저러한 판별을 해주는 것이 바로 ***식별 알고리즘(Marking Algorithm)*** 이다. 

GC를 통한 마킹은 모든 활성 객체와 가비지 수집 준비가 되지 않은 모든 객체에 마킹이 된다.
객체는 이 마킹 여부를 표시하는 **특수 비트**를 갖고 있다.

생성 시에는 해당 비트가 0이고, 마킹 단계에서 객체가 여전히 사용 중이며 제거되지 않아야하는 경우 1로 설정된다.

위 예시 중에서 `member1 = null` 이였던 상황을 재활용해서 스택 프레임과 특수비트를 표기하면 아래와 같을 것이다.

<p align="center">
    <img src="https://i.imgur.com/0g4GOsB.png">
</p>
<p align="center">
    <em>그림 13. 초기 마킹을 하는 상황</a></em>
</p>


초기에는 모두 0으로 표기되다가 마킹을 수행하면, `member1` 제외하고 레퍼런스를 갖고 있기 때문에 아래와 같이 변경된다.

<p align="center">
    <img src="https://i.imgur.com/d0XRhAS.png">
</p>
<p align="center">
    <em>그림 14. 스택에서 직접적으로 레퍼런스로 식별하는 객체 마킹</a></em>
</p>


일단, 먼저 스택 내에서 직접적으로 접근 가능한 레퍼런스들을 갖고 있는 객체들에 대한 특수비트를 1로 바꾼다. 
이 후에 힙 내에서도 접근 가능한 레퍼런스를 마킹한다.

<p align="center">
    <img src="https://i.imgur.com/Cd67rdr.png">
</p>
<p align="center">
    <em>그림 15. 힙 내부의 레퍼런스를 통한 객체 마킹</a></em>
</p>

우리는 JVM에서 GC가 이뤄질 때 접근가능한 객체인지 아닌지를 판별하는 알고리즘을 살펴보았다.
이 마킹 방법에는 크게 2가지 방법이 존재한다.

#### STEP 3.2.1 스탑-더-월드

위에 식별 매커니즘을 보았을 때 궁금한 점이 있지 않은가? 바로 **시점의 충돌**이다. 

> 마킹하는 순간에 새로운 객체가 생겨나면? 
>
> 이 객체는 아직 특수비트가 0일 테고 나중에 GC대상이 될 수 있지 않을까요?

라는 질문이 나올 수 있다. 이러한 시점의 차이로 인해서 살아있어야할 객체가 GC에 의해 수집된다면 아마도 재앙이라고도 볼 수 있을 것이다.

스탑-더-월드 알고리즘은 이름처럼 마킹 단계에서 **새 객체가 생성되지 않도록 실행을 일시 중지하는 기법** 이라고 볼 수 있다.

이 방법은 당연히 어플리케이션 **성능에 매우 치명적인 영향** 을 끼친다. 그래서, 많은 자바 개발자들은 스탑-더-월드가 없이 마킹 단계를 수행하고 싶어하였다. 
이러한 요구사항으로 나온 기법이 바로 **레퍼런스 카운팅(Reference Counting)** 이다.

#### STEP 3.2.2 레퍼런스 카운팅

이 알고리즘은 객체 헤더의 필드를 주어서 레퍼런스 카운트를 저장한 후 이 객체가 다른 객체에 의해 참조되는 경우 해당 객체의 레퍼런스 카운트는 1씩 증가하고, 해제될 경우에는 1씩 감소하는 단순한 매커니즘을 갖고 있다. 

즉, 카운트가 0이 되면 가비지 수집의 대상이 된다. 

스탑-더-월드가 일시 중지하는 이유는 위에서 설명했듯이 잠깐 중단하고, 힙의 모든 레퍼런스를 마킹해야되기 때문이라고 하였다. 하지만, 레퍼런스 카운팅은 실제 힙에 카운트를 저장하는 개념이다보니 이 스탑-더-월드를 최소화시킬 수 있다.

위의 장점만 보면 매우 아름다운 알고리즘이라고 볼 수 있으나, 요즘 GC는 스탑-더-월드 방식을 채택한 후 이 스탑-더-월드 시간을 최소화하는 식으로 발전해왔다.
왜 그럴까? 이 알고리즘은 2가지 단점을 갖고 있다.

1. 카운트 유지 오버헤드 : 각 객체는 레퍼런스 카운트를 유지해야되며, 레퍼런스가 삭제/생성될 때마다 업데이트해야된다. 이는 객체가 많아질 경우 상당한 오버헤드가 발생한다.
2. 고립된 섬 문제(Island of Isolation)[^7] : 순환참조 관계에서 발생하는 문제인데, 순환참조 관계에서는 카운트가 0으로 떨어지지않고 GC가 안되는 문제가 발생하여 메모리 릭이 발생할 수 있다.

<p align="center">
    <img src="https://i.imgur.com/ofah5OD.png">
</p>
<p align="center">
  <em><a href="https://alibabatech.medium.com/how-does-garbage-collection-work-in-java-cf4e31343e43">그림 16. Island of Isolation - Alibaba Tech</a></em>
</p>


즉, 위와 같은 단점들을 갖고 있기 때문에 오늘날에도 우리는 식별 알고리즘에 스탑-더-월드를 사용하고 있는 것이다. 
이제 식별을 했으니 실제 메모리를 지우는 작업을 보고자한다. 이를 정리 알고리즘(Sweep Algorithm)이라 부를 것이다.

### STEP 3.3 정리 알고리즘

정리 알고리즘은 그냥 비워버리는 알고리즘부터 정리하면서 압축하는 알고리즘, 다른 곳으로 복제하는 알고리즘이 존재한다.
기본적인 알고리즘부터 확인해보자. 

#### STEP 3.3.1 기본 정리 알고리즘

기본 정리 알고리즘(Normal Sweeping, Mark-and-Sweep Algorithm)은 아주 단순하다.  아래의 그림을 보면 바로 이해될 것이다.

<p align="center">
    <img src="https://i.imgur.com/LRqNaYu.png">
</p>
<p align="center">
  <em>그림 17. 기본 정리 알고리즘</em>
</p>


마킹 단계에서 접근가능하지 않은 객체로 판별된 녀석들을 위 그림과 같이 할당 해제하는 것이다. 
여기서, 점선은 메모리의 가용 영역이라고 생각하자.

그런데, 위와 같이 처리하면 어떠한 문제가 생길까? 애초에 그림 상으로 봐도 메모리 단편화(Memory Fragmentation)[^8] 이 발생했음을 확인할 수 있다.
만약, 가용용량보다 큰 객체를 할당하고자 하면 어떠한 문제가 발생할까?

<p align="center">
    <img src="https://i.imgur.com/PIgTDYP.png">
</p>
<p align="center">
  <em>그림 18. 크기가 큰 객체는 할당하지 못하는 문제(메모리 단편화)</em>
</p>


위와 같은 객체가 들어오고자하면 두 가용공간 모두 할당을 실패하므로, `OutOfMemory` 가 발생할 것이다.
이러한, 단편화를 막기 위해서 먼저, 접근가능하지 않은 객체를 지운 후 압축을 하는 압축-정리 알고리즘이 탄생하였다.

#### STEP 3.3.2 압축-정리 알고리즘

압축-정리 알고리즘(Sweeping with compacting, Mark-and-Compaction Algorithm)은 위에서 말한 것과 같이 기본 알고리즘 이후에 압축 단계가 추가된 알고리즘이다.

<p align="center">
    <img src="https://i.imgur.com/iuBg8oq.png">
</p>
<p align="center">
  <em>그림 19. 압축-정리 알고리즘</em>
</p>

이렇게 되면, 더 큰 객체도 할당할 수 있게 되고 메모리 단편화 문제도 해결할 수 있다.
하지만 이 알고리즘의 경우 **비용이 매우 비싼데**, 그 이유는 위에서 보면 알 수 있듯이 압축을 하면서 모든 메모리 블록을 이동시키기 때문이다.

이러한 문제때문에 복제-정리 알고리즘이 대두되었다.

#### STEP 3.3.3 복제-정리 알고리즘

복제-정리 알고리즘(Sweeping with copying, Copying Algorithm)은 **아예 메모리 영역을 2개의 공간**으로 나누어서 정리한다는 개념에서 출범하였다.

그 이유는 ***압축 비용보다 영역 자체를 2개를 나눈 뒤 연속적으로 복제하는 것***이 비용이 저렴하기 때문이다.

복제-정리 알고리즘은 2단계로 나눠지는데 그림을 보면 이해하기 쉬울 것이다.

<p align="center">
    <img src="https://i.imgur.com/WFawkyx.png">
</p>
<p align="center">
  <em>그림 20. 복제-정리 알고리즘 (복제 단계)</em>
</p>

GC 대상이 아닌 활성 객체들을 다른 영역에 복제를 한다.

<p align="center">
    <img src="https://i.imgur.com/V7oCY4Z.png">
</p>
<p align="center">
  <em>그림 21. 복제-정리 알고리즘 (정리 단계)</em>
</p>


기존 영역을 모두 정리한다.
이 알고리즘은 압축보다 빠른 성능을 가지는 장점이 있지만, 추가적인 메모리 공간이 필요하다는 단점이 존재한다.
위의 정리 알고리즘은 어떤 가비지 수집기(Garbage Collector)를 선택하는 지에 따라 달려있다.

### STEP 3.4 GC 알고리즘 중간 정리 

우리는 위에서 GC에서 이뤄지는 단계들에 대한 알고리즘을 세부적으로 살펴보았다.

1. 마킹 단계 
	1. 스탑-더-월드
	2. 레퍼런스 카운팅 
2. 스위핑 단계 
	1. 기본 정리 알고리즘
	2. 압축-정리 알고리즘
	3. 복제-정리 알고리즘

마킹 단계에서는 레퍼런스 카운팅의 단점(독립된 섬 문제)[^7]가 존재하여 요즘날의 GC들은 스탑-더-월드 방식을 사용한다고 말했었다. 마킹 후에 새 객체를 위해 공간을 비우는 알고리즘들을 정리 알고리즘이라 말하며, 이에 대한 여러가지 알고리즘을 살펴보았다.

이제 힙 & 스택 영역에서 어떤식으로 GC가 일어나는지를 확인하기에 앞 서 한가지 중요한 알고리즘을 보고 가자.

### STEP 3.5 Generational Algorithm 

복제-정리 알고리즘을 사용하면서 몇 가지 경험적 지식이 체득되었는데 바로 **대부분의 프로그램에서 생성되는 객체는 생성된 지 얼마 되지 않아 GC 대상이 되는 짧은 수명을 갖게 된다는 점**과 또한 **어떤 프로그램도 수명이 긴 몇 개의 객체들은 반드시 가지고 있다는 점**이다. 

이를 **약한 세대 가설(weak generational hypothesis)**[^9]라 한다. 

이 가설이 왜 복제-정리 알고리즘에서 경험적 지식으로 파생되었냐면, 수명이 긴 객체의 경우 위에 복제-정리 알고리즘 매커니즘에 의해서 두 영역을 서로 오고갈텐데 정리 대상은 아니게 되는 것이다.

그러다보니 ***오버헤드가 만만치 않게 된다***는 사실을 알게 된 것이다. 이 사실은 Generational Algorithm이 만들어지는 데 기여를 하였다.
이 알고리즘을 토대로 메모리 단편화, 활용 그리고 복제-정리 알고리즘이 가진 오버헤드를 상당 부분 극복할 수 있었고 각 영역에 대해서 적절한 알고리즘을 선택할 수 있게 되었다.

아래의 그림을 잠깐 봐보자. 

<p align="center">
    <img src="https://i.imgur.com/Cx9dI52.png">
</p>
<p align="center">
  <em><a href="https://www.yes24.com/Product/Goods/3577335">그림 22. Generational Algorithm, Java Performance Fundamental, 김한도 저</a></em>
</p>

①은 GC 이전이고, ②는 GC 이후를 보여준다. 

각 영역에 대해서 적절한 알고리즘을 선택할 수 있게 된다고 얘기했는데 여기서 "Youngest Generation Sub Heap"은 기본 정리 알고리즘처럼 단편화가 발생한 모습을 볼 수 있고, "Oldest Generation Sub Heap" 영역은 복제-정리 알고리즘에 본듯이 처리된 모습을 볼 수 있다. 

> 💡 그림22는 JDK 1.5 시절 그림이므로 "영역별로 각기 다른 알고리즘을 적재적소에 쓸 수 있었다" 정도로 기억하자.

현대의 대부분 가비지 수집기들은 이 알고리즘을 근간에 두고 있고, 밑에서 다룰 기본적인 GC 매커니즘을 설명할 때 나올 힙의 영역들에 대해서도 이 알고리즘의 영향을 받았다.

### STEP 3.6 힙의 구조와 GC의 기본 동작 

<p align="center">
    <img src="https://i.imgur.com/WgCCx2Q.png">
</p>
<p align="center">
  <em>그림 23. 힙 메모리의 구조</em>
</p>

위 그림은 힙의 구조를 나타낸다. 위에서 설명한 "Generational Algorithm" 에 따라서 2개의 세대의 영역으로 분리가 된다.

1. Young Generation Space 
	+ 에덴 영역(Eden Space) : 새로 할당되는 객체들이 위치하는 영역으로, 에덴영역에 더 이상 할당할 수 있는 객체의 공간이 없으면 **마이너 GC가 발생**한다.
	+ 서바이버 영역(Survivor Space) :  2개의 동일한 크기를 가진 영역(S0, S1)으로 구성된다. **마이너 GC**는 이 영역을 서로 변경하면서 복제하는 방식으로 활용한다.  (복제-정리 알고리즘 참고)
2. Old Generation Space
	+ GC에서 살아남은(Survivor Space에 존재하는) 일정 수의 객체가 임계값을 초과하여 생존할 때 넘어가는 공간으로 이 영역에 할당할 수 있는 공간이 없다면 **풀(Full) GC가 발생**한다.

참고로, 서바이버 영역의 `SO, S1` 은 **논리적인 구분이고, 물리적인 구분은 아니다.**

위에서 정리한 내용을 수도코드로 표기하면 아래와 같이 볼 수 있다.

```txt
- 에덴 영역이 가득차면 => 마이너 GC가 실행된다 :
	- Run #1:
		- 처음에 S0가 타겟 서바이버 영역(Target Survivor Space)이라고 가정한다.
		- 활성 객체를 에덴에서 S0로 복제한다; age=1 
		- S1의 활성객체를 검사한다 :
			- age + 1 >= threshold 일 경우 
				Y : 오브젝트를 Old Generation Space로 복제한다.
				N : 오브젝트를 S0로 복제한다; age += 1
		- 에덴영역과 S1를 비운다
		- 에덴영역에 객체를 할당한다
	- Run #2:
		- S1이 타겟 서바이버 영역이면
		- 활성 객체를 에덴에서 S1로 복제한다; age=1 
		- S0의 활성객체를 검사한다 :
			- age + 1 >= threshold 일 경우
				Y : 오브젝트를 Old Generation Space로 복제한다.
				N : 오브젝트를 S1로 복제한다; age += 1
		- 에덴영역과 S1를 비운다
		- 에덴영역에 객체를 할당한다

- Old Generation Space가 가득차면 => 풀 GC가 실행된다 :
	- Old Generation Space를 정리한다.(GC에 따라 다름)
```


이 부분을 그림을 통해서 확인해보자.

<p align="center">
    <img src="https://i.imgur.com/1iwbASD.png">
</p>
<p align="center">
  <em>그림 24. 힙에 새로운 메모리가 할당</em>
</p>

새로운 객체(H)가 들어오고자 하는데, 에덴 영역에 공간이 없는 상황이다.  이때, 마이너 GC가 발생한다.
여기서, 빨간색으로 칠해진 A, D, G가 GC의 대상이라고 생각해보고 아래의 그림을 본 후 수도코드를 다시 한번 보면 어떤 일이 발생 했는지 이해가 될 것이다.

<p align="center">
    <img src="https://i.imgur.com/ee8sm6q.png">
</p>
<p align="center">
  <em>그림 25. 새 객체가 에덴에 할당, 기존 생존 객체들은 서바이버 영역으로 이동</em>
</p>

여기서 살아남은 객체들 밑에 생긴 숫자는 나중에 Old Generation Space로 승격(promotion)하기 위한 기준 값이 된다.
또, 아래의 그림을 봐보자.


<p align="center">
    <img src="https://i.imgur.com/S1JsY1L.png">
</p>
<p align="center">
  <em>그림 26. 추가로 또 마이너 GC가 일어나는 상황</em>
</p>


위와 같은 상황에서 GC가 일어나면 어떤 그림이 그려질 지 생각해보고 아래의 그림을 봐보자. 


<p align="center">
    <img src="https://i.imgur.com/DTcVPnj.png">
</p>
<p align="center">
  <em>그림 27. 생존 객체들을 Target 서바이버 영역으로 복제</em>
</p>

위 그림과 비슷하게 생각했다면 정답이다. 
마이너 GC는 위 매커니즘으로 동작하며, 오래 생존한 객체는 수도 코드에 보이듯  `age + 1 >= threshold` 조건이 될 경우 Old Generation Space으로 승격된다.
이 임계값은  `-XX:MaxTenuringThreshold` 로 조절할 수 있다.

위의 마이너 GC 또한 어떠한 가비지 수집기(Garbage Collector)를 쓰느냐에 따라서 달라지는데 이를 알아보기 앞서 메서드 영역을 살펴보고, 마지막으로 각 가비지 수집기에 대한 특징과 동작 방식을 설명한 후에 글을 마무리 짓도록 하겠다.

## STEP 4. 메서드 영역(메타스페이스 영역)

메서드 영역은 서두에서 설명했던 내용처럼 ***클래스의 메타데이터인 런타임 코드, 정적 변수, 상수 풀 그리고 생성자 코드등을 포함***한다고 하였다.

메서드 영역도 변경의 역사가 존재하는데 이에 대해서 간단하게 짚고 넘어가보자.

### STEP 4.1 자바 8 이전과 이후의 메서드 영역

원래, 이 영역은 본래 자바 8 이전에는 `PermGen` 이라는 영역으로 불렀고, **힙 영역의 일부로 자리**를 하고 있었다. 
물론, 위에서 GC Root Set을 설명할 때 말했지만, 이 영역은 GC의 대상이 아닐 확률이 크고(밑에서 메서드 영역의 GC에 대해서 설명할 것임), 고정된 크기로 할당되었다.
`-XX:PermSize=256m -XX:MaxPermSize=256m` 과 같은 인자를 통해서 늘리거나 줄일 수 있었다.

하지만, 하드웨어 성능이 좋아지고 램은 더 싸지기 시작하면서 자바 언어를 활용하여 더 많은 클래스와 객체들이 올라가기 시작했고 이는 OOM의 원인이 되기도 하였다.
따라서, 이 영역을 대체하고자 하였고 그 내용은 [JEP 122 - Remove the Permnent Generation](https://openjdk.org/jeps/122) 이 이슈를 확인하여 볼 수 있다.

저 이슈에서 "Success Metric" 부분만 발췌해오면 아래와 같다.

> Class metadata, interned Strings and class static variables will be moved from the permanent generation to either the Java heap or native memory.
> The code for the permanent generation in the Hotspot JVM will be removed.
> Application startup and footprint will not regress more than 1% as measured by a yet-to-be-chosen set of benchmarks.   

맨 윗줄을 보면 클래스 메타데이터나 정적 변수 등이 `PermGen` 에서 자바 힙 혹은 네이티브 메모리로 옮겨진다고 되어있다.
이 중 네이티브 메모리 영역으로 옮겨진 부분이 바로, 메타스페이스 영역이다.

즉,  `Metaspace` 영역은 네이티브 메모리에 동작을 함으로써 부족할 경우에 자동으로 늘어나는 식으로 하여 기존의 `PermGen` 에 비해 클래스 로드되는 건 수가 많더라하더라도 비교적 안전해졌다.

물론, `-XX:MaxMetaspaceSize` 인자를 통해서 상한을 지정할 수도 있긴하다.

이뿐만 아니라, 압축 클래스 영역(Compress Class Space) 라는 영역도 추가되었다.

우리가 이 글에서 자주 보았던 레퍼런스는 JVM이 OOPS(Ordinary Object Pointers)[^10]라는 자료구조를 활용하여 관리한다. 

32bit 시스템에서는 oops는 최대 힙을 4GB$(2^{32})$까지 사용할 수 있고, 64bit 시스템에서는 oops는 최대 힙을 18.5EB$(2^{64})$까지 사용할 수 있다.

이것은 이론적인 숫자에 불과하고, 실제로 64bit 포인터로 공간을 관리하는 것은 매우 비효율적이다.

이에, Compressed OOPS라는 녀석이 나왔는데 이는 64bit 환경에서도 OOPS는 32bit 포인터를 활용하게끔 하는 것이다. 이 때문에 많은 자바 어플리케이션들이 32GB 이상 힙 사이즈를 넘지 않는 것을 권고하는 이유기도 하다.

이유는 32GB가 넘어갈 경우에는 Compressed OOPS 기능이 꺼지고, 원래대로 포인터 자체가 64bit를 활용하게 된다.

이러한 이유때문에 ES와 같은 곳에서 32GB 이하의 힙사이즈를 추천 설정으로 이야기하는 것이다. 이 부분에 대해서 궁금하다면 아래의 링크를 참고해보자.

참고 : [ES&Lucene 32GB heap myth or fact? - Elsatic Discuss](https://discuss.elastic.co/t/es-lucene-32gb-heap-myth-or-fact/22920)

이에 대한 자세한 동작 방식이나 매커니즘은 [compressedOops.hpp - OpenJDK github](https://github.com/openjdk/jdk/blob/jdk-18-ga/src/hotspot/share/oops/compressedOops.hpp) 를 참고해보도록 하자.

어쨋든간 중요한 점은 `PermGen` 이라는 기존 힙에서 관리하던 메타데이터들을 네이티브 영역에 분리하였는데 그것을 `Metaspace` 라 부르며,  Compressed OOPS나 네이티브 메모리를 활용한 기능들을 통해서 보다 현대적인 어플리케이션의 요구사항을 감당하게끔 되었다는 점이다.

### STEP 4.2 메서드 영역에서의 GC 동작

간략하게 메서드 영역에 대해서 소개를 진행하였다.
메서드 영역 또한 우리가 위에서 보았던 힙 영역의 Minor GC 매커니즘과 흡사한데 차이점이 있는 부분은 접근가능 객체를 식별하는데 ***클래스 로딩***과 관련이 있다 정도이다.

이 구조를 그림으로 봐보자.

<p align="center">
    <img src="https://i.imgur.com/FSf6dCG.png">
</p>
<p align="center">
  <em>그림 28. 스택, 힙 그리고 메타스페이스의 상황</em>
</p>


에덴 영역에 들어있는 빨간색 동그라미는 ***클래스 로더 객체***를 뜻하며, 파란색은 A 객체, 노란색은 C 객체라고 보면서 설명을 읽어주길 바란다.

+ JVM은 클래스 로더 객체와 A 객체 2개, 그리고 C 객체 1개를 힙에 생성한다.
+ 첫번째 A와 C를 생성할 때, 클래스 로더는 메타스페이스에 A와 C에 대한 메타데이터를 로드한다.
+ 하지만 두번째 A 객체는 메타스페이스에서는 어떤 일도 발생하지않는다. 이미 "Metadata A"가 로드되어 있기 때문이다.

자 이제 아래와 같이 레퍼런스가 변경되었다고 가정해보겠다.

<p align="center">
    <img src="https://i.imgur.com/hCUm3PT.png">
</p>
<p align="center">
  <em>그림 29. A 객체에 대해서 끊어진 레퍼런스</em>
</p>


스택에 대한 레퍼런스 정보가 `pop` 되었지만, GC가 실행되지 않아서 인스턴스가 살아있는 상황이다. 이때 만약, GC가 벌어지면 어떠한 그림으로 변경될까?

<p align="center">
    <img src="https://i.imgur.com/6J1zXZQ.png">
</p>
<p align="center">
  <em>그림 30. 에덴 영역에서 서바이버 영역으로 이동</em>
</p>

위에서 본 내용과 같이 객체 C는 에덴 영역에서 서바이버 영역으로 이동될 것이다. 이때, 클래스 로더 객체도 같이 움직인다.
A 객체가 가비지 수집에 의해서 제거됐지만, 메타스페이스는 A의 메타데이터를 들고 있다. 이는 ***힙에 C 객체가 남아있어서 클래스 로더를 회수 할 수 없기 때문***이다. 
즉, 클래스 로더가 가비지 수집에 의해서 회수가 되고 메타스페이스 영역이 정리가 되려면, ***클래스 로더 객체에 의해 로드된 모든 클래스가 정리***가 되어야만 한다.

이것이 힙 영역에서의 GC와 메서드 영역에서의 GC의 동작 방식 중에 가장 차이가 나는 부분이다.
이제 마지막으로 가비지 수집기에 대해서 다루고 포스팅을 마무리 짓도록 하겠다.

## STEP 5. 가비지 수집기

### STEP 5.1 Serial GC

![](https://i.imgur.com/u6kHGF0.png)

오늘날 개발자들은 자주 사용하지 않을 GC면서 절대로 사용해서는 안되는 방식이다. (CPU 코어가 1개일 경우를 위해서 만든 녀석이다.)

+ Young Generation Space(Minor GC) : 우리가 앞서서 봤던 알고리즘대로 동작한다. (수도코드 참고 (복제-정리 알고리즘과 흡사))
+ Old Generation Space(Full GC) : 압축-정리 알고리즘을 사용한다. 

GC 쓰레드가 수행되면 다음과 같은 순서에 의해서 동작된다.
1. 마킹을 수행 (스탑-더-월드 발생)
2. 정리를 수행
3. 압축을 수행 

해당 GC를 활성하기 위해서는 `-XX: +UseSerialGC` 를 JVM 인자로 넘겨주면 된다.

### STEP 5.2 Parallel GC

![](https://i.imgur.com/EdWHvqU.png)

동작 원리는 Serial GC와 흡사하지만, 멀티쓰레드로 수행한다는 차이가 존재한다. 

+ Young Generation Space(Minor GC) : 우리가 앞서서 봤던 알고리즘대로 동작한다. (단, 병렬 복제를 지원)
+ Old Generation Space(Full GC) : 압축-정리 알고리즘을 사용한다. 

해당 GC가 생겨나게 된 이유는 멀티 코어 혹은 멀티 CPU 환경이 대두되면서, 힙 영역의 크기 또한 덩달아 커져갔고 Serial GC의 스탑-더-월드는 길어져만 갔다.
이 길어진 스탑-더-월드를 해결하고, 어플리케이션의 처리량(Throughput)을 증대시키는 것을 목표로 하였다.

병렬로 여러 쓰레드를 사용하여 동시에 힙 영역을 정리하며,  스탑-더-월드가 발생하지만 Serial GC와 비교해서 시간이 보다 짧으므로 더 나은 성능을 갖는다.

주의할 점은 병렬 쓰레드로 처리되다보니 두 개의 쓰레드나 프로세스가 동일 메모리 공간을 점유하는 레이스 컨디션 문제가 발생할 수 있다. 이 때문에 동기화 작업이 수반되어야하는데 이 경우 서바이버 영역에서 살아남은 객체들을 승격하는 성능이 떨어지게 된다. 이 때문에, HotSpot VM에서는 PLAB(Parallel Local Allocation Buffer)[^11]라는 승격용 버퍼를 만들었다. 해당 부분은 각주를 보고 참고하자.

이 GC를 활성화하기 위해서는 `-XX: +UseParallelGC` 인자를 전달하자.

### STEP 5.3 CMS GC

![](https://i.imgur.com/EYVaigT.png)

CMS(Concurrent Mark & Sweep) GC는 아래의 특징을 갖고 있다.

+ Young Generation Space(Minor GC) : 우리가 앞서서 봤던 알고리즘대로 동작한다. (수도코드 참고 (복제-정리 알고리즘과 흡사))
+ Old Generation Space(Full GC) : 동시성 기본 정리 알고리즘(Concurrent Mark & Sweep)

이 알고리즘의 초점은 GC 이벤트(Fast Elapsed Time)의 기간을 줄이는 것이다. 
즉, 스탑-더-월드의 시간을 적절하게 분산하여 응답시간을 개선하는데 초점을 둔 수집기라고 볼 수 있다.

이를 단계별로 설명하면 아래와 같다. 

1. Initial Mark 
	+ 힙 내부의 모든 살아있는 객체를 살피는 것이 아니라 Root Set에서 직접적으로 연결된 객체만 마킹한다. 따라서, 스탑-더-월드는 매우 짧다. 
	+ 그림에서 보는 바와 같이 이 단계는 싱글 쓰레드로 동작한다.
2. Concurrent Mark 
	+ Initial Mark 단계에서 식별된 객체들을 대상으로 레퍼런스를 추적하여 마킹을 수행한다.  
	+ 이때, 다른 쓰레드가 실행 중인 상태에서 동시에 진행된다. (즉 파란색 쓰레드들은 어플리케이션 실행에 쓰인다.)
3. Remark 
	+ Concurrent Mark 단계에서 새로 추가되거나 레퍼런스가 끊긴 객체를 확인한다. (실제 스탑-더-월드 발생이 제일 긺)
4. Concurrent Sweep 
	+ Remark 단계에서 최종적으로 수집 대상이 된 객체들을 정리한다. (이 작업도 다른 쓰레드가 실행 중인 상황에서 동작한다.)

중요한 점은 다른 GC들과 다르게 압축을 수행하지 않는데, 그 이유는 동시성(Concurrent)를 보장하기 위해서는 힙 영역 전체가 멈추는 상황을 최소화해야하는데, 압축을 수행하게될 경우에 위에서 살펴본 바와 같이 모든 메모리 블록을 움직여야하고 그렇다면 힙 영역을 멈춰야하는 작업이 필요하다. 따라서, CMS GC는 압축을 수행하지 않는다.

위에서 본 압축을 안하면 생기는 단점처럼 CMS 역시, 단편화 현상을 유발할 수 있다.
이를 위해서 Freelist를 활용하는데 이를 활용하면 Freelist를 탐색하는 과정이 추가되기 때문에 승격(Promotion) 시간이 길어지고, 에덴 영역 혹은 서바이버 영역에 객체가 체류하는 시간이 늘어난다.

하지만 압축은 위에서 말했듯이 비용이 매우 비싼 작업이므로 승격이 자주 일어나지 않는 경우에 성능 상의 이점을 가져갈 수 있다.

### STEP 5.4 G1(Garbage First)GC

![](https://i.imgur.com/k5VpgxW.png)

자바11부터 기본적으로 설정되는 GC로, 지금까지 살펴보았던 GC들과 다르다. 
위에서 Generational Algorithm에 의해서 힙의 구조가 설계되었고, 대부분의 GC는 이를 따른다고 하였다.

하지만, G1GC는 Young Generation Space와 Old Generation Space의 물리적인 공간을 허물고, 논리적으로만 분리되게끔 하였다.

이러한 이유는 위에서 본 GC들의 단점에서부터 비롯되었는데 CMS GC를 설명하면서 결국 압축을 하지않음으로서 파편화가 발생할 수 있다고 하였다. 여기서는 생략했지만 CMS GC 이후에 Parallel Compaction GC라는 수집기도 생겼는데 이름에서만 봐도 알 수 있듯이 결국 다시 "압축" 방식으로 회귀하였다. 

G1GC는 이러한 근본적인 문제를 해결하기 위해서 물리적인 Generation의 구분을 없애고 전체 힙 영역을 리전(Region)이라는 단위로 개편하였다. 
따라서, 더 이상 세대를 관리하는 두 공간 모두 연속된 메모리 공간이라는 보장도 사라졌고, Young / Old라는 개념도 논리적인 개념으로만 자리잡게 되었다.

이름에서 보듯이 이 수집기의 동작원리를 알 수 있는데 Garbage로 차있는 Region부터 먼저(First) 정리를 수행하기 때문에 G1GC라는 이름이 붙이게 되었다.
추가적으로 "Humongous Region" 처럼 큰 크기의 객체를 할당하기 위한 리전도 추가가 되었다.

+ Minor GC 

Young Generation 리전들을 대상으로 접근가능한 객체를 찾아낸 후 일정 임계치를 넘지 않은 객체들은 서바이버 리전으로 복제(Copy)한다.
임계치를 넘은 리전들은 Old Generation 리전으로 복제한다. 그리고 기존의 Young Generation은 가비지로 간주하여 Region 단위로 할당을 해지한다.

+ Full GC 

Minor GC가 끝나면 바로 Full GC가 발생한다. 그렇다고 해서 이전의 GC들처럼 힙 영역 전반에 걸친 가비지 수집이 일어나지는 않고, Region 단위로 발생한다.
이러한 까닭에 스탑-더-월드 현상도 해당 리전을 사용하는 쓰레드에 국한된다. 이러한 기법을 통해서 가비지 수집의 충격을 최소화하였다.

간략한 플로우는 아래와 같다.

1. Minor GC 발생 (Evaucation Pause) : 위의 Minor GC와 동일
2. Concurrent Mark : 마킹 / 리마킹으로 구분이된다.
	+ 마킹(Marking) : 이전 단계에서 변경된 정보를 토대로 Initial Mark를 빠르게 수행한다. (CMS 참고, CMS와 같이 동시적으로 수행 가능)
	+ 리마킹(Remarking) : 전체 쓰레드가 함께 작업에 참가하여, 스탑-더-월드가 발생하며 각 리전마다 접근가능한 객체를 판별하며 가비지 리전은 다음 단계로 넘어가지 않고 이 단계에서 해지된다.
3. Old Region Reclaim : Old 리전에 대한 회수 단계로 여기도 리마킹 / Evacauation Pause 단계가 포함된다. 
	+ 리마킹(Remarking) : 가비지 수집을 위해 살아있는 객체의 비율이 낮은 리전 중 몇 개를 추려내는 작업을 수행한다. 
	+ Evacuation Pause : Young 리전에 대한 가비지 수집도 포함하며, 리마킹 단계에서 식별한 Old Region과 같이 수집이 된다. 
		+ 이렇게 함으로써, 생존률이 높은 리전들만 골라낼 수 있게되고 이 단계에서 Young / Old에 대한 작업이 동시적으로 수행되서 Mixed-GC라고도 부른다. 
4. Compaction : 다른 GC의 압축과 달리 동시성을 보장해준다. 이러한 방식이 가능한 이유는 리전단위로 작업을 수행하기 때문이다. 이를 토대로 단편화를 방지할 수 있다.

![](https://i.imgur.com/7LqTMaD.png)

이에 대한 GC Cycle도 존재하는데 Young-only 단계는 위에서 본 Minor GC의 시작으로 시작되며, 이후  Old Region Reclaim 단계가 Space Reclamation 단계라고 보면 된다.
여기서 Mixed-GC가 수행되서 공간을 확보하며, 더 이상 효율적으로 Old 리전을 줄일 수 없다 판단되면 다시 Young-only 단계로 돌아간다. 

# 결론 

어쩌다보니까 초 장문의 글이 되었다. 
정리해서 담으려다보니 대부분의 내용을 담고 싶어졌고, 오히려 욕심때문인지 글이 매우 길어졌다.

일단, 새벽에 작성하는 글이라 추후 다음을 예정인데 혹시라도 다듬기 전에 글을 보고 계시는 분이라면 댓글로 오타나 수정사항이 있으면 알려주시면 감사할 것 같다.

아무쪼록 매우 긴 글인데 읽어주셔서 감사합니다.

# 레퍼런스 및 참고자료 

1. [Chapter 2. The Structure of the Java Virtual Machine - Oracle Java SE17 JVM Spec](https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html#jvms-2.6.2)
2. [Back to the Essence - Java 컴파일에서 실행까지 - (1) - HomoEfficio](https://homoefficio.github.io/2019/01/31/Back-to-the-Essence-Java-%EC%BB%B4%ED%8C%8C%EC%9D%BC%EC%97%90%EC%84%9C-%EC%8B%A4%ED%96%89%EA%B9%8C%EC%A7%80-1/)
3. [Back to the Essence - Java 컴파일에서 실행까지 - (2) - HomoEfficio](https://homoefficio.github.io/2019/01/31/Back-to-the-Essence-Java-%EC%BB%B4%ED%8C%8C%EC%9D%BC%EC%97%90%EC%84%9C-%EC%8B%A4%ED%96%89%EA%B9%8C%EC%A7%80-2/)
4. [How Does Garbage Collection Work in Java? - Alibaba Tech](https://alibabatech.medium.com/how-does-garbage-collection-work-in-java-cf4e31343e43)
5. [JVM stack과 frame - 기계인간 John Grib](https://johngrib.github.io/wiki/jvm-stack/)
6. [방어적 복사(defensive copy) - 기계인간 John Grib](https://johngrib.github.io/wiki/defensive-copy/)
7. [Java PermGen의 역사 - 데브원영](https://blog.voidmainvoid.net/315)
8. [Java 8에서 JVM의 변화 : PermGen이 사라지고 Metaspace가 등장하다. - goodGid](https://goodgid.github.io/Java-8-JVM-Metaspace/)
9. [JEP 122: Remove the Permanent Generation - OpenJDK Project](https://openjdk.org/jeps/122)
10. [JVM Trobleshooting MOOC - Oracle](https://www.oracle.com/webfolder/technetwork/tutorials/mooc/JVM_Troubleshooting/week1/lesson1.pdf)
11. [JVM Compressed OOPS - xephysis](https://xephysis.tistory.com/6)
12. [Compressed OOPs in the JVM - Baeldung](https://www.baeldung.com/jvm-compressed-oops)
13. [JVM 메모리 구조와 GC - 기계인간 John Grib](https://johngrib.github.io/wiki/jvm-memory/)
14. [일반적인 GC 내용과 G1GC (Garbage-First Garbage Collector) 내용 - ThinkGround](https://thinkground.studio/2020/11/07/%EC%9D%BC%EB%B0%98%EC%A0%81%EC%9D%B8-gc-%EB%82%B4%EC%9A%A9%EA%B3%BC-g1gc-garbage-first-garbage-collector-%EB%82%B4%EC%9A%A9/)
15. [1. G1GC - keep going](https://velog.io/@hanblueblue/GC-1.-G1GC)
16. [Why 35GB Heap is Less Than 32GB – Java JVM Memory Oddities - codecentric](https://www.codecentric.de/wissens-hub/blog/35gb-heap-less-32gb-java-jvm-memory-oddities)

[^1]: [댕글링 포인터(Dangling Pointer) -THINK-PRO BLOG](https://thinkpro.tistory.com/67)
[^2]: [HotSpot(virtual machine) - wikipedia](https://en.wikipedia.org/wiki/HotSpot_(virtual_machine))
[^3]: [Java Virtual Machine Specification - Oracle Docs](https://docs.oracle.com/javase/specs/jvms/se17/html/jvms-2.html#jvms-2.6.3)
[^4]: [방어적 복사(defensive copy) - 기계인간 John Grib](https://johngrib.github.io/wiki/defensive-copy/) 
[^5]: [일급 콜렉션(First Class Collection)의 소개와 써야할 이유 - 기억보단 기록을](https://jojoldu.tistory.com/412)
[^6]: [Object Copying - wikipedia](https://en.wikipedia.org/wiki/Object_copying)
[^7]: [The curious case of Island of Isolation - Arun Jijo](https://medium.com/javarevisited/curious-case-of-island-of-isolation-6243f3a6698d)
[^8]: [메모리 단편화(Memory Fragmentation)가 무엇이고 왜 발생하는가? - 기본기를 쌓는 정아마추어 코딩블로그](https://jeong-pro.tistory.com/91)
[^9]: [Generations - Oracle JDK8 Docs](https://docs.oracle.com/javase/8/docs/technotes/guides/vm/gctuning/generations.html)
[^10]: [CompressedOops - OpenJDK Wiki](https://wiki.openjdk.org/display/HotSpot/CompressedOops)
[^11]: [Thread-Local Allocation Buffers in JVM - Kemikit](https://alidg.me/blog/2019/6/21/tlab-jvm) 