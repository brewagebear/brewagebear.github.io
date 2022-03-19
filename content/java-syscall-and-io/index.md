---
title: 시스템 콜과 자바에서의 시스템 콜 사용례 
date: 2022-03-19 00:51:00 +0900
tags: 
    - Java
    - JVM
emoji: 💻
author: 개발한입
categories: 개발
---

```toc
```

# 시스템 콜과 자바에서의 시스템 콜 사용례 
# 목차
+ 개요
  + STEP 1. 시스템 콜이란?
    + STEP 1.1 운영체제와 시스템 콜
  + STEP 2. 자바와 시스템 콜
    + STEP 2.1 I/O 향상을 위한 운영체제 수준의 기술
      + STEP 2.1.1 버퍼(Buffer) 
      + STEP 2.1.2 Scatter/Gather
      + STEP 2.1.3 가상메모리
      + STEP 2.1.4 메모리 맵 파일(MMIO)
      + STEP 2.1.5 파일 락
    + STEP 2.2 중간정리
  + STEP 4. 자바에서의 블록킹 I/O와 논블로킹 I/O 차이
    + STEP 4.1 자바의 포인터 버퍼 도입
    + STEP 4.2 네이티브 I/O 서비스를 제공 채널 도입
    + STEP 4.3 셀렉터 도입 
  + STEP 3. REFERENCE
# 개요
최근에 CS를 다시 공부하면서 궁금한 점이 많아졌다. 특히 그 부분 중에서 제일 컸던 부분은 시스템 콜 부분이었다. 운영체제를 공부하면서 많은 학부생들이나 개발자들이 느끼는 감정이 그래서 이게 어디서 쓰이는데 혹은 어디에 접목할 수 있는데 일 것이다.

예를 들면 프로세스와 쓰레드도 그렇다고 생각한다. 단순하게 `synchorized` 키워드를 붙어서 동기화 처리를 한다고 생각하지만, `synchorized` 키워드를 사용할 경우에는 자바에서는 세마포어를 추상화 시킨 모니터라는 개념을 통해서 동시성 제어를 하게된다.

이번에 CS를 공부하면서 초점을 맞춘 부분도 이론으로 배운 운영체제 내용들이 실제로 우리가 개발하는데 어떤 방식으로 사용되는지 궁금해졌고, 그 중에서 시스템 콜에 대해서 내용을 다루기로 생각했다.

# STEP 1. 시스템 콜이란? 
일단, 시스템 콜은 **사용자 프로세스가 커널 프로세스에게 어떠한 문맥을 요청하면서 발생하는 것**이다. 

이를 알기 전에 약간의 운영체제 지식이 필요하니 운영체제에 대해서 조금 훑고 가고자 한다.

## STEP 1.1 운영체제와 시스템 콜
운영체제의 사용 목적은 다음과 같다.
+ **사용자가 편리하게 컴퓨터 시스템을 편리하게 사용할 수 있는 환경을 제공**
+ **컴퓨터 시스템 안의 하드웨어를 효율적으로 관리하기 위함**

그렇다면 이러한 궁금증이 들 수 있다고 생각한다. 
> 어떻게 하드웨어를 효율적으로 관리하고, 편리하게 사용할 수 있는 환경을 제공할까?

오늘날 대부분의 운영체제는 시분할 시스템이다. **시분할 시스템은 일련의 작업들을 시간단위로 나눠서 처리**한다. 이 작업들은 운영체제에서 자원을 할당받아서 돌아가는 프로세스이다. 

이 시간 단위가 매우 짧기 때문에 사용자 입장에서는 여러 프로그램들을 운영체제에서 실행해도 동시에 실행되는 것 처럼 느껴진다.

즉, 프로세스는 **운영체제 위에서 실행 중인 프로그램**이라고 볼 수 있다.
당연히 이러한 환경이다보니 어떤 프로세스의 자원 처리나 하드웨어 작업 등의 처리가 나날이 복잡해졌다. 

우리가 C언어를 사용할 때 생각해보자. 어떠한 메모리를 할당받았으면 반드시 프로그래머는 해당 구문이 더 이상 메모리가 필요가 없다면 `free()` 를 처리해서 자원을 반납해줬어야했다.  

하지만, Java와 같은 언어들은 `GC(Garbage Collection)`을 지원하면서 자원 반납에 대한 프로그래머의 부담을 해소시켜줬다. 

운영체제도 그러한 편리함을 제공해준다고 봐도 무방하지 않을까 생각이 든다.
일례면 우리가 크롬을 켜두고 유튜브로 음악을 들으면서 워드로 문서 작업을 하고 있다고 생각해보자. 우리는 자원의 할당이나 반납을 생각하지 않고 사용하면 된다. 

위에서 나온 운영체제의 목적 중에서  **사용자가 편리하게 컴퓨터 시스템을 편리하게 사용할 수 있는 환경을 제공** 이 부분이라고 생각해도 될 것 같다.

물론 가끔 너무 많은 리소스를 사용하면 해당 프로그램이 먹통이 되서 대기를 해야된다던가 강제 종료를 하는 부분이 존재하긴 하지만, 평소에 사용할 때는 아무 신경을 쓰지않는다. 이건 운영체제가 알아서 자원을 할당하고 처리해주기 때문이다. 

정리를 하자면, **운영체제는 사용자가 자원의 관리나 할당에 신경을 쓰지 않고 처리할 수 있는 것들을 제공해서 편리하게 사용자들이 쓸 수 있게 해준다.**

자 그러면 다시 생각해보자. 

> 엥 우리가 C로 짤때 `malloc` 과 같은 것으로 직접 메모리를 할당받고 그랬는데 이건 운영체제의 역할 아닌가요?

정답이다. 

운영체제는 크게 2가지 모드로 프로세스를 동작시킨다. 
1. 사용자 모드(User mode) 
2. 커널 모드(Kernel mode) 

물론 크게 2가지로 나눠지는 것이고, 더 세분화된 모드들이 많다. 일단 위의 두 가지의 모드로만 봐보자. 

1은 우리가 **사용하는 대부분의 프로그램들이 동작하는 모드**이다. 
2는 **운영체제 내부의 커널이 관리하는 프로세스의 모드**이다. 

운영체제 수업때 돌이켜서 생각하면 운영체제가 보안적인 측면도 관리해준다고 교수님 혹은 조교(?)님께서 얘기해줬을 때가 있다. 운영체제는 커널 모드를 통해서 외부의 접근을 최소화해야하는 영역을 지정해두고 보안성을 높였다. 이 부분이 커널모드인 것이다. 

**사용자 모드가 커널 영역에 직접 접근하는 것이 아니라 운영체제에게 요청을 하면 해당 처리를 운영체제에 위임을 해서 처리하도록 하였다.**

이것이 바로 **시스템 콜**이다. 

재밌는 만화가 있으니 참고해보자.
[유저영역과 커널영역 혹은 유저모드와 커널모드 : 네이버 블로그](https://m.blog.naver.com/PostView.naver?isHttpsRedirect=true&blogId=sheep_horse&logNo=221271778167)

따라서, 우리가 C를 사용하면서 `malloc` 과 같은 명령어를 수행하면 내부적으로 시스템 콜이 발생해서 운영체제에게 이 요청을 위임한다. 
운영체제는 해당 명령어를 해석하고 할당해서 완료가 되면 해당 프로세스에게 알려주고 다시 프로세스는 사용자 모드로 동작한다.

중요한 점은 단순하게 메모리 용량 할당 뿐만 아니라 I/O 작업이나 네트워크 작업 등 커널 영역이 필요한 모든 곳에서는 시스템 콜이 필요하다.

즉, 우리가 사용하는 프로세스는 수 없이 많이 **사용자모드와 커널모드**를 왔다갔다하면서 작업을 수행하는 것이다.

자 이제 시스템 콜에 대해서 얼추 알게되었다. 그렇다면 자바에서 주로 시스템 콜이 발생하는 부분은 어디일까? 제일 보편적인 것이 I/O 작업이라고 할 수 있다.

이제 이것에 대해 알아보고자 한다.

# STEP 2. 자바와 시스템 콜
자바와 시스템 콜의 내용을 언급하기 이전에 JVM 내용이 들어갈 예정이니 [Java JVM과 Class Loader의 동작 과정 이해 - 개발 한입](https://brewagebear.github.io/fundamental-jvm-classloader/)를 한번 보고오는 것도 추천한다.

위에서는 C의 예시를 들어서 시스템 콜을 얘기했다. C는 포인터를 통해서 메모리에 직접 접근할 수 있다보니 시스템 콜이 다이렉트로 발생시킬 수 있다고 할 수 있다. 물론 이 때문에 포인터를 사용해서 어떠한 작업을 한 뒤에 자원 반납을 프로그래머가 직접 작성해야되는 문제점이 있다.

하지만, Java는 JVM 위에서 동작을 한다. 그렇기 때문에 시스템 콜 자체가 느려질 수 있는 상황이다.

큰 차이점을 대략적으로 그림을 그려보았다. 


![79A34C97-4FED-433C-8BD1-9CE861DD37CD](https://user-images.githubusercontent.com/22961251/159037748-447ecfb1-b145-4541-bb9c-f935267041f9.png)


![E19A384D-C163-4042-8226-751983FA0FBE](https://user-images.githubusercontent.com/22961251/159037763-4b35b28c-b08e-43c6-9ebf-17b197f02dba.png)



C의 경우에는 메모리 할당하는 부분이고, Java의 경우에는 디스크에서 파일을 읽을 때라고 가정한다. 

개략적으로 그린 그림이라 어떤차이인지 잘 모를 수 있다고 생각한다. 핵심은 C의 경우에는 시스템 콜을 직접 사용할 수 있지만 (`malloc` 이 시스템콜은 아니고 시스템 콜을 사용하는 API이다.) 자바의 경우에는 간접적으로 사용해야된다. 

만약 C로 I/O를 한다하면 아래와 같은 흐름으로 시스템 콜이 발생할 것이다.

`C 프로세스 -> 시스템 콜 -> 커널 -> 디스크 컨트롤러 -> 데이터 복사`

자바는 아래와 같은 흐름으로 이뤄진다. 

`JVM -> JNI -> 시스템 콜 -> 커널 -> 디스크 컨트롤러 -> 커널 버퍼 복사 -> JVM 버퍼 복사`

즉, 시스템 콜을 사용하기 위해서 자바는 내부적으로 네이티브 메서드를 활용하기 때문에

어떻게보면 JVM이라는 한 껍데기가 더 씌워져있기도 하고 내부에 버퍼가 존재하는데 여기서는 파일 읽기를 처리한다고 가정하였다. 이때 읽기 요청을 한 쓰레드가 디스크에서 프로세스 내부 버퍼로 복사를 할 때 Blocking이 발생하기도 한다. 

이 부분을 그림으로 표현하면 다음과 같다.

![sync-blocking](https://user-images.githubusercontent.com/22961251/159037775-75bd8b44-9391-4bc0-bc8f-5ada04f28bf5.png)


이렇게 `read()` 명령동안 해당 쓰레드는 작업을 못하게 되는 것이다. 
이러한 부분때문에 **자바 IO는 느리다** 라는 얘기가 나오게되었다. 

이러한 부분을 개선한 것이 `nio` 패키지인데 이를 보기 전에 느린 I/O를 처리하기하기 위해서 운영체제는 많은 기능을 제공하는데 다음을 알아보고자 한다. 

## STEP 2.1 I/O 향상을 위한 운영체제 수준의 기술
자바 혹은 다른 언어를 사용하더라도 결국 **시스템 콜**을 사용하는 I/O는 느릴 수 밖에 없다. 그래서 운영체제는 이 I/O 향상을 위한 다양한 기술들을 제공하는데 크게 다음과 같다.

1. 버퍼(Buffer)
2. Scatter/Gather
3. 가상메모리(Virtual Memory)
4. 메모리 맵 파일
5. 파일 락 

이를 각각 살펴보고자 한다.

### STEP 2.1.1 버퍼(Buffer) 
먼저 버퍼를 설명하기 앞서 시스템 콜 영역을 좀 더 세부적으로 그려보면 다음과 같다.

![C216A603-6E1C-4B6A-BB34-80AED5EA0952](https://user-images.githubusercontent.com/22961251/159037786-47c7eb77-f8f0-401d-ab9b-97b1326e28fa.png)


유저 영역과 커널 영역에서 버퍼를 사용하는 모습을 볼 수 있다.
여기서 DMA(Direct Memory Access)[^1] 와 Disk Controller(I/O Controller)[^2] 는 운영체제 내용이니 넘어가고자 한다.

버퍼는 무엇이고, 왜 사용하는 것일까?
아주 단순하다 데이터를 하나씩 여러번 반복적으로 전달하는 것보다 중간에 버퍼를 두고 그 버퍼에 데이터를 모아 한 번에 효율적이기 때문이다.

즉, 버퍼는 효율적으로 데이터를 전달하는 객체이다.
따라서, 데이터를 전송하는 곳에서 대부분 버퍼를 사용하는데 운영체제도 예외는 아니다.

버퍼의 이점을 알아보기 위해 세 가지 코드로 테스트 해보고자 한다.
1. 버퍼를 사용하지 않고 1바이트씩 10MB 파일을 읽어들임 
2. 2048byte 크기의 버퍼를 만들어서 10MB 파일을 읽어들임
3. 10MB 크기의 버퍼를 만들어서 10MB 파일을 읽어들임


먼저 버퍼를 사용하지 않는 코드를 볼텐데 코드는 다음과 같다.

+ 버퍼를 사용하지 않고 1바이트씩 10MB 파일을 읽어들임 

```java
public class NotUsedBuffer {

    private static final String COPY_ORIGIN_FILE = "/Users/liquid.bear/Downloads/test.txt";

    private static final String COPY_DEST_FILE = "/Users/liquid.bear/Downloads/test2.txt";

    public static void main(String[] args) {
        try {
            long startTime = System.currentTimeMillis();
            copy(COPY_ORIGIN_FILE, COPY_DEST_FILE);
            long endTime = System.currentTimeMillis();

            System.out.println("버퍼를 사용하지 않을 경우 처리 시간 : " + (endTime - startTime) + " milli seconds");

        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private static void copy(String origin, String dest) throws IOException {

        try(InputStream in = new FileInputStream(origin);
            OutputStream out = new FileOutputStream(dest)) {

            while(true) {
                int byteData = in.read();

                if(byteData == -1) {
                    break;
                }
                out.write(byteData);
            }
        }
    }
}
```

`test.text` 파일은 10MB 크기의 파일이다. 
맥을 사용하고 있다면 `mkfile -n 10m test.txt` 이런식으로 원하는 크기의 파일을 아주 손쉽게 만들 수 있다.

핵심은 `copy()` 메서드 내부의 `while` 문이다. 1바이트씩 읽으면서 파일 쓰기를 처리하고 있다. 

다음은 2048byte 크기의 버퍼를 통해서 복사하는 예시이다.

달라진 부분은 크게 없다 `BufferedInputStream inputBuffer = new BufferedInputStream(in, 2048);` 를 추가해서 읽기 버퍼를 추가했을 뿐이다.

궁금한 점이 있을 수 있다 
> 왜 BufferedOutputStream은 사용하지 않았나요? 

즉, 쓰기 또한 1바이트씩 읽어서 쓰는게 아니라 버퍼에 담아두고 `EOF` 를 만났을 때 버퍼에 쓰인 값을 한번에 쓰는게 훨씬 빠를 것이다. 이 예시는 단순히 읽기 버퍼만 사용한 이유는 시간 값 차이를 확인하기 위함이라고 알아두면 될 것이다. (쓰기 버퍼를 쓰면 차이가 현저히 적어진다.) 

일단 먼저 두 개의 파일 복사 시간 차이를 확인해보자.

<img width="402" alt="Screen Shot 2022-03-18 at 17 14 21" src="https://user-images.githubusercontent.com/22961251/158962217-f810a078-0fd4-49bb-9b58-ff818828e15f.png">

<img width="399" alt="Screen Shot 2022-03-18 at 17 14 16" src="https://user-images.githubusercontent.com/22961251/158962219-2aed57ed-c18c-4252-a839-6e4befe2f511.png">


생각보다 큰 차이를 보임을 알 수 있다. 그러면 읽기 버퍼를 파일 사이즈만큼 했을 때는 얼마나 빠를까? 

```java
...(중략)...
	int available = in.available();
	byte[] bufferSize = new byte[available];

	while(true) {
		int byteData = in.read(bufferSize);
...(중략)...
```

이런식으로 읽은 파일 크기 만큼 버퍼를 사용하도록 하였다. 
그렇다면 버퍼에 10MB 크기 전체가 읽힐 것이고, **이 속도는 한번에 읽고 한번에 쓰기가 가능한 속도가 될 것이다.** 

<img width="363" alt="Screen Shot 2022-03-18 at 17 14 06" src="https://user-images.githubusercontent.com/22961251/158962225-439e7937-90c2-4f68-bda6-04a05fc9f871.png">


따라서 속도는 제일 빠르게 된다. 

전체 코드는 [blog-example/buffer-example](https://github.com/brewagebear/blog-example/tree/main/buffer-example/src/main/java) 을 참고해보자.

이렇게 버퍼를 사용하지 않는 경우와 사용하는 경우는 I/O 속도차이가 꽤 난다는 것을 알 수 있다. 버퍼는 운영체제 뿐만 아니라 I/O가 많은 DB같은데서도 사용하는데 3번 예시와 같이 전체 파일의 크기로 버퍼를 만들면 당연히 `OOM` 발생 가능성이 존재하니 이를 테이블 데이터나 인덱스 크기에 맞춰서 적절한 값으로 튜닝하기도 한다. 

### STEP 2.1.2 Scatter/Gather
위에서는 버퍼에 대해서 알아보았다. 그렇다면 Scatter와 Gather는 어떤 기능을 제공해줄까? 

만약, 내가 버퍼를 N개를 만들어서 사용하는데 동시에 I/O 작업이 이뤄진다고 가정해보자. 그렇다면, N번의 시스템 콜이 일어날 수 있다고 추론할 수 있다. 시스템 콜은 문맥교환과 비교해서 적은 비용이지만 그렇다고 비용이 아예 발생하지 않는 건 아니다. 

이렇게 **N번의 시스템 콜을 요청하는 경우 당연히 비효율적**이라고 볼 수 있다.
이러한 문제 때문에 운영체제는 Scatter와 Gather를 제공해준다. 

+ Scattering Read
![6DDE1098-1B1C-4795-B28F-4B94F4D314B7](https://user-images.githubusercontent.com/22961251/159037807-6943164b-3068-4792-b8d5-e1256da1e5e6.png)


+ Gathering Write 
![5BED0995-D5D5-4FA1-BCF7-107038B13A7B](https://user-images.githubusercontent.com/22961251/159037824-91d11a3b-dfdb-47a5-b0ae-eafa9f0120ae.png)


Scatter와 Gather의 흐름은 위의 그림과 같다. 
이를 통하면 시스템 콜이 1번만 발생한다. 대신, 내부적으로 호출할 때마다 사용할 버퍼의 주소 목록을 넘겨줌으로서, 주어진 버퍼들로부터 순차적으로 읽거나 쓴다.

자바에서는 이런 기능을 이용하기 위해서 `java.nio.channel` 패키지에 
`ScatteringByteChannel` 과 `GatheringByteChannel` 을 제공해준다.

+ java.nio.channel.ScatteringByteChannel
<img width="435" alt="Screen Shot 2022-03-18 at 17 59 20" src="https://user-images.githubusercontent.com/22961251/159037840-711dd3a4-bb11-4f9e-ba0c-c1fbe28f64a9.png">


+ java.nio.channel.GatheringByteChannel
<img width="428" alt="Screen Shot 2022-03-18 at 18 00 40" src="https://user-images.githubusercontent.com/22961251/159037880-8ee935bd-a4d3-4256-b9db-2d956d9649a1.png">


이는 아마 다음 포스팅에서 I/O와 NIO 차이 포스팅을 생각중인데 그 때 자세히 다룰 것 같다. 

### STEP 2.1.3 가상메모리 

I/O 관점에서 가상메모리[^3] 를 다룰 예정이여서 가상메모리는 다른 참고자료들을 참고해보자. 

I/O 관점에서 가상메모리르 사용함으로 얻는 장점은 다음과 같다.
1. 실제 물리 메모리 크기보다 큰 가상 메모리 공간 사용 가능
2. 여러 개의 가상 주소가 하나의 물리적 메모리 주소를 참조함으로써 메모리를 효율적으로 사용 가능 

가상 메모리를 사용하면 2개의 버퍼를 사용하더라도 뒤에서 볼 **메모리 맵 파일**을 통해서 동일한 영역에 접근이 가능해진다. 따라서, 커널 영역 -> 유저 영역으로 데이터를 복사를 하지않아도 된다.

+ 커널 및 유저 영역과 매핑된 가상 메모리
![C6434205-068F-4709-9EC2-ABF10C327B1A](https://user-images.githubusercontent.com/22961251/159037912-0006eb17-c15f-44c2-bc7d-164393d33c07.png)


이런식으로 같은 영역을 사용한다고 볼 수 있다. 

### STEP 2.1.4 메모리 맵 파일 (Memory-mapped I/O)
위에서 가상메모리와 버퍼에 대해서 이야기를 했다. 또한, 가상메모리를 설명할 때 유저 가상 메모리와 커널 가상 메모리가 매핑되려면 메모리 맵 파일을 사용한다하였는데 이번에 이 메모리 맵 파일에 대해서 알아보고자 한다.

우리가 인텔리제이를 사용한다고 가정해보자. 인텔리제이 또한 자바 기반으로 만들어져있는데 코드를 입력할 때마다 I/O 시스템 콜이 발생할 것이다. 그리고 입력된 값을 다시 버퍼에 옮기는 작업이 이뤄질 것이고, **복사를 한 후에 가비지가 생기고 이를 또 가비지 컬렉터가 처리할 것**이다.

가비지 컬렉터가 가비지를 수거하는 것은 상당히 느린 작업이고, 많은 기업들이 GC 튜닝하는데 공을 들이는 이유일 것이다.

이러한 문제점을 해결하기 위해 운영체제에서 지원하는 것이 `MMIO(Memory-mapped I/O)`[^4] 이다.

위의 가상메모리 부분을 구현하는 부분이 이 부분이라고 생각해도 좋을 것 같다.
가상메모리 설명 부분에서 말했듯이 `MMIO` 를 통하면 `read()` , `write()` 와 같은 시스템 콜을 할 필요가 없어진다고 하였다. 

또 다른 장점으로는 매우 큰 파일을 복사하기 위해 많은 양의 메모리를 소비하지 않아도 된다는 점이다.  이러한 이유는 내부적으로 `MMIO` 는 시스템의 페이지들을 메모리로 바라보기 때문에 필요한 부분만 메모리에 로드해서 사용하기 때문이다. 

자바에서는 `java.nio.MappedByteBuffer` 클래스가 `MMIO` 과 관련해서 사용되는 버퍼이다.

+ java.nio.MappedByteBuffer
<img width="436" alt="Screen Shot 2022-03-18 at 18 26 33" src="https://user-images.githubusercontent.com/22961251/159037930-af577366-4e2e-4595-a264-7a57abf22bdc.png">


### STEP 2.1.5 파일 락
DB를 공부하면 배타 락(X-Lock, Exclusive-Lock)과 공유 락(S-Lock, Shared-Lock)에 대해서 듣게된다. 배타 락은 주로 **쓰기 작업**에 사용되고 공유 락은 **읽기 작업**에 사용된다.

사실 이 배타 락과 공유 락은 DB에만 존재하는 개념이 아니라 운영체제에서도 사용된다.
어떠한 파일을 통해서 작업을 하고 있는데 다른 프로세스나 혹은 쓰레드가 같은 파일에 대한 작업을 못하게 막아야하기 때문에 배타 락과 공유 락이 사용된다.

원래 자바 1.4 이전에는 **파일 락 기능을 제공하지 않았다**고 한다. 이 부분도 운영체제의 기능 중 하나였기 때문이다. 또한, 파일 락은 프로세스들의 접근 자체를 제한하거나 접근하는 방법에 제한을 줘야 했어서 JVM에서 처리가 불가능하기도 했다. 

NIO 패키지에서는 이러한 파일 락 기능을 제공하기 시작했다.

+ java.nio.channels.FileChannel.lock()
<img width="755" alt="Screen Shot 2022-03-18 at 18 33 03" src="https://user-images.githubusercontent.com/22961251/159037960-b00de0a5-dd67-4879-8673-f5df4316db0c.png">


# STEP 4. 자바에서의 블록킹 I/O와 논블로킹 I/O 차이
위에서 다뤘던 내용은 대부분 블록킹 I/O에 관련된 내용이었다.  이제 NIO(None-Blocking I/O)에는 블록킹 I/O와 어떤 차이가 있는지 알아보고자 한다.

1. 자바의 포인터 버퍼 도입
2. 네티이브 I/O 서비스르 제공해주는 채널 도입
3. 셀렉터 도입 

위의 3가지가 가장 큰 차이라고 볼 수 있다.

## STEP 4.1 자바의 포인터 버퍼 도입
블록킹 I/O와  NIO의 가장 큰 차이는 `Buffer` 클래스 도입일 것이다. 
위에서 본 내용 중에서 Java는 JVM 위에서 동작하고, JVM은 하나의 프로세스이기 때문에 I/O가 비효율적이며, 블록킹되며 운영체제가 제공해주는 효율적인 기능들도 사용하지 못했다.

하지만 NIO에서는 커널에 의해 관리되는 **시스템 메모리를 직접 사용할 수 있는**`Buffer` **클래스가 도입되었다.** 물론 `DirectByteBuffer` 에 한정된 것이지만, 이를 통해서 기존 배열로서 처리해야 했던 많은 부분들이 좀 더 효율적이고, 편리하게 다룰 수 있도록 배려해주는 많은 메서드도 제공해주기 시작했다.

결론적으로 포인터가 자바에도 생겼다고 볼 수 있는데, 이는 다음 포스팅에 NIO를 다루면서 깊게 얘기해보고자 한다.

## STEP 4.2 네이티브 I/O 서비스를 제공 채널 도입
기존 스트림은 단방향이었던 거에 비해서, NIO에서는 채널(Channel)을 도입함으로써 양방향 통신이 가능하게 되었다. 또한, 운영체제에서 제공해주는 네이티브 I/O 서비스들을 이용할 수 있게 되었다.

채널은 버퍼 클래스와 함께 작업하도록 되어있고 이를 통해서 시스템 메모리인 버퍼에 직접적으로 데이터를 읽거나 쓸 수 있게 되었다. 또한 채널은 위에서 알아본 것처럼 Scatter, Gather를 구현해서 I/O를 보다 효율적으로 처리할 수 있게 되었다.

정리하자면, 네이티브 I/O 서비스를 이용할 수 있는 채널의 도입과 이로 인해 버퍼 클래스와 함께 작업하는 양방향 통신이 가능해졌다는 것이다. 

## STEP 4.3 셀렉터 도입 
위에서 얘기한 내용처럼 버퍼, 채널과 함께 셀럭터라는 개념이 도입되었다.
셀렉터는 네트워크의 효율을 높이기 위한 것인데 기존 자바 네트워크 프로그래밍에서는 클라이언트 하나당 스레드 하나를 생성해서 처리를 하였는데 이게 비효율적이여서 나중에는 쓰레드 풀을 도입해서 처리하기도 하였다.

NIO에서는 셀렉터를 이용함으로써 단 한 개의 쓰레드로 수천에서 수 만의 동시 사용자를 처리할 수 있는 서비스를 만들 수 있게 되었다.

이 또한 NIO 추가 포스팅을 통해서 알아보고자 한다.

# STEP 5. 정리
지금까지 운영체제에서 대략적인 시스템 콜과 시스템 콜이 제일 많이 발생하는 I/O 작업에 대해서 자바에서는 어떻게 처리되는지 그리고 어떻게 발전했는지 알아보았다.

고전적인 Blocking I/O와 NIO의 차이도 알아보았는데 아마도 다음에는 NIO에 대해서 얘기를 하면서 깊게 들어가볼까 한다.

대부분의 내용은 [자바 IO & NIO 네트워크 프로그래밍](https://www.hanbit.co.kr/media/books/book_view.html?p_code=B3301693698) 책을 참고하였다.

운영체제의 내용은 [KOCW - 이화여대 운영체제](http://www.kocw.net/home/search/kemView.do?kemId=1046323) 강의 내용이 매우 좋으니 한번 쯤 보기를 권한다.

# REFERENCE 
1. [intro-syscall](https://pages.cs.wisc.edu/~remzi/OSFEP/intro-syscall.pdf)
2. [How does JVM makes system calls? - Quora](https://www.quora.com/How-does-JVM-makes-system-calls)
3. [blocking, non-blocking IO, 동기, 비동기 개념 정리 | limdongjin](https://limdongjin.github.io/concepts/blocking-non-blocking-io.html#ibm-%E1%84%8B%E1%85%A1%E1%84%90%E1%85%B5%E1%84%8F%E1%85%B3%E1%86%AF)

[^1]:[Direct memory access - Wikipedia](https://en.wikipedia.org/wiki/Direct_memory_access)
[^2]:[I/O Communication and I/O Controller | Computer Architecture](https://witscad.com/course/computer-architecture/chapter/io-communication-io-controller)
[^3]:[가상 메모리 - 위키백과, 우리 모두의 백과사전](https://ko.wikipedia.org/wiki/%EA%B0%80%EC%83%81_%EB%A9%94%EB%AA%A8%EB%A6%AC)
[^4]:[Memory-mapped I/O - Wikipedia](https://en.wikipedia.org/wiki/Memory-mapped_I/O)