---
title: "[Kernel] 커널과 함께 알아보는 소켓과 TCP Deep Dive"
date: 2023-10-12 17:45:00 +0900
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

이번 내용은 커널 저변에 깔린 소켓에 대한 내용과 소켓을 처리하는 TCP에 대해서 살펴볼 예정이다. 

원래는 NUMA를 다룰려 했으나 다른 스터디 팀원분께서 정리하는걸 기대하고 필자는 소켓과 TCP를 중점적으로 설명해보고자 한다.

간략하게 이번 포스팅의 내용을 소개하면 아래와 같다.

**소켓이 무엇인지와 TCP는 어떻게 실제 연결 수립/해제가 이뤄지고, 메시지를 송/수신 하는지?**

**그리고 TCP로 인해 발생할 수 있는 서비스의 문제점**들이라 보면 될 것같다. 

## STEP 1. 소켓이란? 

우리가 개발을 하면서 소켓(Socket)이라는 단어는 수도 없이 많이 들어보았을 것이다. 

네트워크 저변에는 소켓으로 통신을 하는데 그렇다면 이 소켓의 정의는 무엇일까? 

> A way to speak to other programs using standard Unix file descriptors
> + Beej's Guide to Network Programming Using Internet Sockets

뜻을 해석하면, **표준 유닉스 파일 디스크럽터(File Descriptors)를 통해서 다른 프로그램과 정보를 교환하는 방법**이라고 해석할 수 있을 것이다.

왜 뜬금없이 파일 디스크럽터가 나왔을까? 이 부분은 UNIX 진영에서 얘기하는 **"Everything is a file"**[^1] 라는 개념을 이해해야한다. 

간단히 얘기하자면, **다양한 리소스에 발생하는 입/출력을 단순한 파일과 같은 바이트 스트림으로 처리한다는 개념**인데, 소켓도 여기에 해당하므로 위와 같은 정의를 내릴 수 있는 것이다.

잘 생각해보면 우리가 네트워크에 어떠한 데이터를 보낼 때 바이트 직렬화와 역직렬화 과정을 거치는데 이 이유가 **"Everything is a file"**[^1] 의 개념때문이라고도 볼 수 있다.

그렇다면 파일 디스크럽터는 어떻게 가져올 수 있을까? 그것은 바로 시스템 콜중에 하나인 `socket()` 을 통해서 가능하다.

```c
// https://github.com/torvalds/linux/blob/master/net/socket.c#L1625
static struct socket *__sys_socket_create(int family, int type, int protocol)
{
	struct socket *sock;
	int retval;

	/* Check the SOCK_* constants for consistency.  */
	BUILD_BUG_ON(SOCK_CLOEXEC != O_CLOEXEC);
	BUILD_BUG_ON((SOCK_MAX | SOCK_TYPE_MASK) != SOCK_TYPE_MASK);
	BUILD_BUG_ON(SOCK_CLOEXEC & SOCK_TYPE_MASK);
	BUILD_BUG_ON(SOCK_NONBLOCK & SOCK_TYPE_MASK);

	if ((type & ~SOCK_TYPE_MASK) & ~(SOCK_CLOEXEC | SOCK_NONBLOCK))
		return ERR_PTR(-EINVAL);
	type &= SOCK_TYPE_MASK;

	retval = sock_create(family, type, protocol, &sock);
	if (retval < 0)
		return ERR_PTR(retval);

	return sock;
}

// https://github.com/torvalds/linux/blob/master/net/socket.c#L1686
int __sys_socket(int family, int type, int protocol)
{
	struct socket *sock;
	int flags;

	sock = __sys_socket_create(family, type,
				   update_socket_protocol(family, type, protocol));
	if (IS_ERR(sock))
		return PTR_ERR(sock);

	flags = type & ~SOCK_TYPE_MASK;
	if (SOCK_NONBLOCK != O_NONBLOCK && (flags & SOCK_NONBLOCK))
		flags = (flags & ~SOCK_NONBLOCK) | O_NONBLOCK;

	return sock_map_fd(sock, flags & (O_CLOEXEC | O_NONBLOCK));
}

// https://github.com/torvalds/linux/blob/master/net/socket.c#L1703
SYSCALL_DEFINE3(socket, int, family, int, type, int, protocol)
{
	return __sys_socket(family, type, protocol);
}
```

위 함수가 실제 시스템 콜의 내부 구현 부분이다. 실제 호출 흐름은 아래와 같다. 

1. 유저 공간에서 `socket()` 함수 호출 
2. 커널에서 시스템콜 인터페이스를 통하여 `SYSCALL_DEFINE3` -> `__sys_socket()` 함수 호출
3. `__sys_socket()` 함수 호출 시 내부적으로 `__sys_socket_create()` 함수 호출을 통해 소켓 생성 
4. `__sys_socket()`은 전달받은 소켓을 파일 디스크럽터에 매핑하여 파일 디스크립터를 유저공간에 반환 
5. 유저 공간에서 반환 받은 파일 디스크럽터를 통한 다양한 I/O 작업 수행 

이러한 방식으로 FD를 얻게된 후 `send(), recv()` 같은 함수를 통해서 정보교환을 할 수 있는 것이다.

그림으로 보면 아래와 같다.

<p align="center">
    <img src="https://i.imgur.com/ERkokdv.png">
</p>
<p align="center">
    <em>그림 1. 소켓 생성 과정</em>
</p>


그렇다면 글을 읽는 독자분들께서는 이러한 궁금증이 생길 수도 있을 것이다.

> 어차피, 파일을 사용하는 거면 `read(), write()` 와 같은 시스템 콜을 써서 처리해도 되지 않나요?

물론 위 방식도 가능하다. 하지만 소켓도 통신 규약이 있으며 정보 제어를 하기 위해서는 `send(), recv()` 같은 함수를 쓰는걸 권장하는 것이다. 

### STEP 1.1 소켓의 종류 

소켓의 종류는 매우 다양하다. 인터넷 소켓과 유닉스 소켓, X.25 소켓 등이 존재[^3]한다. 

유닉스 소켓은 차후에 다룰 수 있다고 생각하는데 이번 포스팅에서는 인터넷 소켓만 다루고자 한다. 

인터넷 소켓도 여러 종류[^2] 가 있는데 크게 3가지이다.

1. 스트림 소켓(Stream Socket, `SOCK_STREAM`)
2. 데이터그램 소켓(Datagram Socket, `SOCK_DGRAM`)
3. RAW 소켓(Raw Socket, `SOCK_ROW`)

이번 포스팅에서는 **스트림 소켓과 데이터그램 소켓**에 대해서 알아보고자 한다.

#### STEP 1.1.1 스트림 소켓 

스트림 소켓은 양측을 신뢰성있게 연결해주는 소켓이다. 어떠한 데이터를 이 소켓을 통해서 보내면 그 순서는 보장되며, 에러 검출 혹은 교정 기능까지 있다. 

> 신뢰성이 있고, 순서가 보장되며 에러 검출같은 기능들이 있는 것 이거 어디서 본 개념아닌가?

지금 생각하고 있는 개념이 맞다. 

스트림 소켓은 **TCP를 이용**하기 때문에 위와 같은 기능들을 가질 수 있는 것이다.

#### STEP 1.1.2 데이터그램 소켓

반면, 데이터그램 소켓은 신뢰도가 떨어지며, 비연결지향적인 특징을 지닌다.

> 신뢰성이 없고, 비연결지향적인 특징 이것도 어디서 본 개념아닌가?

아마 다들 알 것이라 생각한다. **데이터그램 소켓은 UDP에서 사용하는 소켓**이다.

## STEP 2. 커널 코드로 알아보는 TCP와 소켓

위에서 간단하게 소켓의 정의와 종류에 대해서 알아보았다. 이번 포스팅에서는 **스트림 소켓** 즉, TCP를 집중적으로 분석해 볼 예정이다.

그림1에서 간단하게 소켓 시스템 콜 시에 어떻게 소켓이 생성되고, 파일 디스크럽터를 반환하는 지를 보았다.

그렇다면, 스트림 소켓의 구조는 어떻게 생겼을까? 

<p align="center">
    <img src="https://i.imgur.com/tuwGhkk.png">
</p>
<p align="center">
    <em><a href="https://os.korea.ac.kr/wp-content/uploads/2020/11/10_TCP-in-Linux.pdf">그림 2. System Programming - TCP in Linux, Korea Univ, 2020, p.9</a></em>
</p>


소켓은 다양한 구조체가 존재하는데 이 중에서 가장 추상화된 구조체가 `struct socket`[^4] 이다.

이 구조체(`stuct socket`[^4])가 종류에 따라서 결국 바깥쪽 껍데기가 다르게 씌어진다고 보면된다. 

그렇다면, `struct tcp_sock`[^5] 라는 스트림 소켓은 언제 초기화가 될까? 전반적인 흐름은 위 그림과 같으나, 스트림 소켓은 `tcp_init_sock()`[^6] 함수가 호출되면서 초기화가 된다고 보면된다.

`tcp_init_sock()`[^6] 함수 호출 이후 생성된 구조체에 대한 데이터를 보면 아래와 같다.


<p align="center">
    <img src="https://i.imgur.com/wZcWe16.png">
</p>
<p align="center">
    <em><a href="https://os.korea.ac.kr/wp-content/uploads/2020/11/10_TCP-in-Linux.pdf">그림 3. System Programming - TCP in Linux, Korea Univ, 2020, p.11</a></em>
</p>


여기서는 상태와 종류만 짚고 넘어가자. 중요한 `write, receive, backlog queue` 에 대해서는 통신 과정을 설명하면서 짚어보고자 한다. 
초기화 이후니 당연히 상태는 `SS_UNCONNECTED` (연결이 안된 상태) 일 것이고, TCP 소켓이므로 종류는 `SOCK_STREAM` 으로 생성되었음을 확인할 수 있다.
 
### STEP 2.1 커널 코드로 알아보는 TCP Handshake 과정  

위에서는 소켓 생성과정과 스트림 소켓에 대한 초기화 과정, 구조에 대해서 간략히 살펴보았다.

이제 TCP 연결 수립과 해제 과정인 3-Way Handshake와 4-Way Handshake에 대해서 커널 레벨에서 보고자 한다.

우선 당연하게도 네트워크 계층에 대한 이해가 필요하다.

<p align="center">
    <img src="https://i.imgur.com/cqp4KBo.png">
</p>
<p align="center">
    <em>그림 4. 네트워크 계층</em>
</p>


여기서 중요한 점은 클라이언트 입장이 아닌 서버 입장에서 봐야한다는 점이다.

**클라이언트 입장에서는 당연히 Application Layer -> Network Interface Layer의 과정을 통해서 서버에 패킷을 전송한다.**

**서버 입장에서는 요청이 Network Interface Layer -> Application Layer로 처리될 것이다.**

그림으로 보면 아래와 같다.


<p align="center">
    <img src="https://i.imgur.com/SYUaRAp.png">
</p>
<p align="center">
    <em>그림 5. 네트워크 계층으로 보는 요청/응답 과정</em>
</p>

우리는 클라이언트의 요청 과정보다는 서버가 응답하는 과정속에서 일어나는 과정을 보고자한다.

클라이언트가 요청을 받았을 경우 TCP의 3Way-Handshake가 시작되는 지점은 어디일까?

바로, 정보가 **Internet Layer -> Transport Layer로 전달된 시점**에 일어날 것이다.

#### STEP 2.1.1 3-Way Handshake

**Internet Layer -> Transport Layer로 전달된 시점**에 대한 커널 코드를 보면 Handshake 과정을 추적할 수 있다.

아래 코드 조각은 해당 과정에서 이뤄지는 함수들과 로직을 일부분 가져왔다.

```c
// https://github.com/torvalds/linux/blob/master/net/ipv4/ip_input.c#L560
/*
 * IP receive entry point
 */
int ip_rcv(struct sk_buff *skb, struct net_device *dev, struct packet_type *pt,
	   struct net_device *orig_dev) 
{
	... (중략) ...
}

//https://github.com/torvalds/linux/blob/master/net/ipv4/ip_input.c#L242
/*
 * 	Deliver IP Packets to the higher protocol layers.
 */
int ip_local_deliver(struct sk_buff *skb)
{
	... (중략) ...
}

//https://github.com/torvalds/linux/blob/master/net/ipv4/tcp_ipv4.c#L1982
int tcp_v4_rcv(struct sk_buff *skb)
{
	... (중략) ...
}

//https://github.com/torvalds/linux/blob/master/net/ipv4/tcp_ipv4.c#L1707
int tcp_v4_do_rcv(struct sock *sk, struct sk_buff *skb)
{
	... (중략) ...
	if (tcp_rcv_state_process(sk, skb)) {
		rsk = sk;
		goto reset;
	}
	return 0;
	
reset:
	tcp_v4_send_reset(rsk, skb);
	... (중략) ...
}


//https://github.com/torvalds/linux/blob/master/net/ipv4/tcp_input.c#L6476
/*
 *	This function implements the receiving procedure of RFC 793 for
 *	all states except ESTABLISHED and TIME_WAIT.
 *	It's called from both tcp_v4_rcv and tcp_v6_rcv and should be
 *	address independent.
 */
int tcp_rcv_state_process(struct sock *sk, struct sk_buff *skb)
{
	... (중략) ...
	switch (sk->sk_state) {
	case TCP_CLOSE:
		... (중략) ...

	case TCP_LISTEN:
		if (th->ack)
			return 1;

		if (th->rst) {
			... (중략) ...
		}
		if (th->syn) {
			... (중략) ...
		}
		SKB_DR_SET(reason, TCP_FLAGS);
		goto discard;

	case TCP_SYN_SENT:
		... (중략) ...
		return 0;
	}
	... (중략) ...
	switch (sk->sk_state) {
	case TCP_SYN_RECV:
		... (중략) ...
	case TCP_FIN_WAIT1:
		... (중략) ...
	case TCP_CLOSING:
		... (중략) ...
	case TCP_LAST_ACK:
		... (중략) ...
	... (중략) ...
}
```

실제 코드는 주석에 달아둔 링크를 확인하면서 팔로우를 하면 될 것 같다.
플로우만 이해하기 위해서 불필요한 코드는 전부 생략했다. 이 프로세스를 이해하고 싶으면 코드를 정독해보도록 하자.

플로우는 아래와 같다.
1. 아이피 계층으로 프레임이 전달되면, `ip_rcv()` 함수가 호출
2. 내부적인 작업을 거친 후 `ip_local_deliver()` 함수를 통해 TCP 계층으로 전달
3. `tcp_v4_rcv()` 함수가 호출되며 내부적인 작업을 수행 후 `tcp_v4_do_rcv()` 함수를 호출
4. `tcp_v4_do_rcv()` 함수는 분기를 가진다.
	1. `TCP_ESTABLISHED` 상태 (이미 연결 수립된 상태)면 `tcp_rcv_established()` 함수 호출
	2. 해당 상태가 아니면 연결 수립 과정을 위한 `tcp_rcv_state_process()` 호출
5. `tcp_rcv_state_process()` 함수 내부 로직을 통한 실제 **3-Way Handshake** 수행

#### STEP 2.1.2 4-Way HandShake

위에서는 3-Way HandShake을 커널 레벨에서 살펴보았다. 

생각보다 복잡하다고 생각할 수 있겠지만, CS 공부를 어느정도 한 독자분들이라면 쉽게 이해했을 것이라 생각한다. 

3-Way에 비해 4-Way HandShake는 많이 간단하다.

```c
//https://github.com/torvalds/linux/blob/master/net/ipv4/tcp_input.c#L4374
/*
 * 	Process the FIN bit. This now behaves as it is supposed to work
 *	and the FIN takes effect when it is validly part of sequence
 *	space. Not before when we get holes.
 *
 *	If we are ESTABLISHED, a received fin moves us to CLOSE-WAIT
 *	(and thence onto LAST-ACK and finally, CLOSE, we never enter
 *	TIME-WAIT)
 *
 *	If we are in FINWAIT-1, a received FIN indicates simultaneous
 *	close and we go into CLOSING (and later onto TIME-WAIT)
 *
 *	If we are in FINWAIT-2, a received FIN moves us to TIME-WAIT.
 */
void tcp_fin(struct sock *sk)
{
	... (중략) ...
	switch (sk->sk_state) {
	case TCP_SYN_RECV:
	case TCP_ESTABLISHED:
		/* Move to CLOSE_WAIT */
		tcp_set_state(sk, TCP_CLOSE_WAIT);
		inet_csk_enter_pingpong_mode(sk);
		break;
	case TCP_CLOSE_WAIT:
	case TCP_CLOSING:
		/* Received a retransmission of the FIN, do
		 * nothing.
		 */
		break;
	case TCP_LAST_ACK:
		/* RFC793: Remain in the LAST-ACK state. */
		break;

	case TCP_FIN_WAIT1:
		/* This case occurs when a simultaneous close
		 * happens, we must ack the received FIN and
		 * enter the CLOSING state.
		 */
		tcp_send_ack(sk);
		tcp_set_state(sk, TCP_CLOSING);
		break;
	case TCP_FIN_WAIT2:
		/* Received a FIN -- send ACK and enter TIME_WAIT. */
		tcp_send_ack(sk);
		tcp_time_wait(sk, TCP_TIME_WAIT, 0);
		break;
	default:
		/* Only TCP_LISTEN and TCP_CLOSE are left, in these
		 * cases we should never reach this piece of code.
		 */
		pr_err("%s: Impossible, sk->sk_state=%d\n",
		       __func__, sk->sk_state);
		break;
	}
	... (중략) ...
}
```

위 함수가 우리가 알고 있는 연결 종료과정에서 발생하는 **4-Way Handshake** 로직에 해당하는 `tcp_fin()` 함수이다.

해당 함수는 `FIN` 비트가 인입되면 호출되는 함수라고 보면된다.

### STEP 2.2 커널 코드로 알아보는 TCP 메시지 송/수신 과정 

<p align="center">
    <img src="https://i.imgur.com/SYUaRAp.png">
</p>
<p align="center">
    <em>그림 5. 네트워크 계층으로 보는 요청/응답 과정</em>
</p>

위에서 보았던 그림을 다시 가져왔다. 이를 가져온 이유는 TCP 송/수신과 연관이 있기 때문이다. 

우리가 어떠한 응용프로그램을 작성했고, 해당 어플리케이션은 HTTP 통신을 한다고 가정해보자.

그렇다면, 메시지를 **다른 곳에 보내기 위해서는 왼쪽부분과 같이 Application -> Network Interface 레이어를 거치는 작업을 통해서 메시지를 전달**할 것이다.

반대로 **수신하는 입장에서는 응용프로그램까지 어떠한 정보가 도착하기 위해서는 Network Interface -> Application 레이어를 거치는 작업**을 진행할 것이다.

즉, 아래와 같이 정리할 수 있다.

1. **메시지 송신 : Application Layer -> Network Interface Layer로 이뤄지는 프로세스** 
2. **메시지 수신 : Network Interface Layer -> Application Layer로 이뤄지는 프로세스** 

이러한 개념을 보고 아래의 과정을 보는게 좀 더 이해하는데 도움이 될 것이다.

#### STEP 2.2.1 TCP 송신 과정


<p align="center">
    <img src="https://i.imgur.com/Ubiupzw.png">
</p>
<p align="center">
    <em><a href="https://www.cs.unh.edu/cnrg/people/gherrin/linux-net.html">그림 6. Message Traffic Overview, New Hampshire Univ, 2000</a></em>
</p>


위에서 설명한 바와 같이 **Application Layer -> Network Interface(= Link) Layer** 로 이뤄지는 작업들을 볼 수 있다.
전반적인 플로우는 아래와 같다.

1. 소켓 쓰기 시스템콜 발생 (`__sys_sendto()`[^7])
	1. 소켓에서 메시지 전송 과정 수립 (`sock_sendmsg()`[^8])
	2. 메시지 헤더를 적용 가능한 전송계층 프로토콜(TCP/UDP)로 전송(`inet_sendmeg()`[^9]) 
2. TCP 계층에서 전송 과정 진행 
	1. 사용자 공간에서 페이로드를 커널 공간으로 복사한다. (`tcp_sendmsg()`[^10])
	2. 혼잡제어 기능 수행을 위한 작업 수행 (`tcp_write_xmit()`[^11])
	3. TCP 헤더를 붙이고 전송 (`tcp_transmit_skb()`[^12])
3. 하위 계층에서 전송을 위한 처리 진행 

여기서는 중요한 함수 1가지정도만 보고자한다.

먼저, `tcp_sendmsg()`[^10] 함수이다. 이 함수는 유저 공간에서 커널 공간으로 데이터를 버퍼로 복사해 `struct tcp_sock` 의 `write queue` 쪽에 데이터를 추가하는 작업을 진행한다.

<p align="center">
    <img src="https://i.imgur.com/b4O9xVe.png">
</p>
<p align="center">
    <em><a href="https://os.korea.ac.kr/wp-content/uploads/2020/11/10_TCP-in-Linux.pdf">그림 7. System Programming - TCP in Linux, Korea Univ, 2020, p.19</a></em>
</p>


#### STEP 2.2.2 TCP 수신 과정

<p align="center">
    <img src="https://i.imgur.com/NdGpFCI.png">
</p>
<p align="center">
    <em><a href="https://www.cs.unh.edu/cnrg/people/gherrin/linux-net.html">그림 8. Message Traffic Overview, New Hampshire Univ, 2000</a></em>
</p>



위에서 설명한 바와 같이 **Network Interface(= Link) Layer -> Application Layer** 로 이뤄지는 작업들을 볼 수 있다.

사실, 메시지 수신 과정은 이미 3-Way Handshake를 진행하면서 다뤘다고 보면 된다. 전체 플로우는 위의 3-Way Handshake 내용을 참고하도록 하고, 여기서는 세부사항들에 대해서 짚고 넘어가야할 것들을 짚고 넘어가려고 한다.

TCP 수신 부분에서는 크게 2가지의 대기열을 사용한다. 

1. **수신 대기열(Receive Queue) : 네트워크에서 수신했지만 어플리케이션에서 읽지 않은 데이터를 위한 대기열**
	+ `recv()` 와 같은 시스템 콜을 통해서 해당 대기열에서 데이터를 검색하며, 이 대기열이 가득차면 전송 속도 조절하도록 발신자에게 호출.
2. **백로그 대기열(Backlog Queue / Accept Queue) :  서버에서 수신했지만 아직 어플리케이션에서 승인하지 않은 연결 요청 처리를 위한 대기열**
	+ `accept()`과 같이 새 연결을 준비할 때, 커널은 이 대기열에서 가장 오래된 연결 요청을 검색 후 새 소켓을 생성.

이 전에는 사전 대기열(PreQueue / Pre-Demux Queue)라는 개념이 존재하였는데 4.14버전 이후 삭제되었다. 
+ [tcp: remove prequeue support : Github](https://github.com/torvalds/linux/commit/e7942d0633c47c791ece6afa038be9cf977226de)

이 두가지 큐를 토대로 `tcp_v4_rcv()` 함수를 이해해보자.

```c
int tcp_v4_rcv(struct sk_buff *skb) // sk_buff는 소켓 버퍼를 뜻한다.
{
	...
	const struct iphdr *iph; // IP 레이어 헤더 
	const struct tcphdr *th; // TCP 헤더 
	...
	th = (const struct tcphdr *)skb->data; // sk_buff에 담겨있는 페이로드를 통해 헤더의 시작위치를 참조
	iph = ip_hdr(skb); // sk_buff를 통해 IP 헤더를 식별한다. 
	...
	process : // TCP 처리를 담당하는 부분 
	...
		if (!sock_owned_by_user(sk)) { // 유저 공간에서 해당 소켓을 사용중이지 않으면 
			ret = tcp_v4_do_rcv(sk, skb); // 실제 연결 수립과정을 수행한다.
		} else { // 유저 공간에서 해당 소켓을 사용중이면
			if (tcp_add_backlog(sk, skb, &drop_reason)) // 백로그 대기열에 넣는다 
				goto discard_and_relse; 
		}
	...
}
```

얼추 이해가 되었을 것이라 본다. 

백로그 대기열에 대한 이해는 되었다고 볼 수 있는데 그렇다면 수신 대기열은 언제 사용되는걸까? 

이를 알기 위해서는 `tcp_v4_do_rcv()` 함수를 먼저 알아보자.


```c
int tcp_v4_do_rcv(struct sock *sk, struct sk_buff *skb)
{
	if (sk->sk_state == TCP_ESTABLISHED) { /* Fast path(이미 상태가 연결 수립된 케이스) */
		... 
		tcp_rcv_established(sk, skb);
		return 0;
	}	
	...
	/* Slow path(연결 수립 상태가 아닐 경우) 아래의 작업들을 끝낸 후 핸드셰이킹 수행 */
	if (tcp_checksum_complete(skb))  // 체크섬 검사 수행 
		goto csum_err;
	...
	if (sk->sk_state == TCP_LISTEN) {
		struct sock *nsk = tcp_v4_cookie_check(sk, skb);  // SYN 쿠키 검사 수행 
		
		if (!nsk) 
			goto discard; 

		if (nsk != sk) // SYN 쿠키 검사 이후 소켓과 매개변수 소켓이 다르면 (SYN Flood 방어 매커니즘 ) 
		{ 
			if (tcp_child_process(sk, nsk, skb)) // 자식 소켓 처리
			{
				 rsk = nsk; goto reset; 
			} 
			return 0; 
		}
	}
	...
	// 위와 같은 예외처리 매커니즘 통과 후 실제 핸드셰이킹을 위한 작업 수행 
	if (tcp_rcv_state_process(sk, skb)) 
	{ 
		rsk = sk; 
		goto reset; 
	}
}
```

TCP에서 수신을 처리하기 위한 작업은 분기를 통해서 처리가 되는데 
1. 기존 소켓이 `TCP_ESTABLISHED` 상태 : **Fast Path로 처리가 될 확률이 높다.**
2. 기존 소켓이 `TCP_ESTABLISHED` 상태가 아닌 경우 : **Slow Path로 처리가 될 확률이 높다.**

당연히, `TCP_ESTABLISHED` 가 아니라면 핸드셰이크 작업이 이뤄질 것이다. 어쨋든 최종적으로 두 가지 모두 `tcp_rcv_established()` 라는 함수를 호출하는데 이때도 차이를 보인다.

```c
// https://github.com/torvalds/linux/blob/master/net/ipv4/tcp_input.c#L5868
void tcp_rcv_established(struct sock *sk, struct sk_buff *skb)
{
	...
	if (tcp_header_len == sizeof(struct tcphdr) + TCPOLEN_TSTAMP_ALIGNED) { // 밑에 케이스에 걸리는 경우에는 Slow Path이다.
		/* No? Slow path! */
		if (!tcp_parse_aligned_timestamp(tp, th))
			goto slow_path;

		/* If PAWS failed, check it more carefully in slow path */
		if ((s32)(tp->rx_opt.rcv_tsval - tp->rx_opt.ts_recent) < 0)
			goto slow_path;
	}
	...
	} else {
		...
		if ((int)skb->truesize > sk->sk_forward_alloc)
			goto step5; // 이 또한 Slow Path로 처리하는 작업이다.
		...
	
		eaten = tcp_queue_rcv(sk, skb, &fragstolen); // 실제 수신 큐에 데이터를 넣는다. (Fast Path)
			
		if (TCP_SKB_CB(skb)->ack_seq != tp->snd_una) {
			...
			if (!inet_csk_ack_scheduled(sk))
				goto no_ack;
		} else {
			tcp_update_wl(tp, TCP_SKB_CB(skb)->seq);
		}
	}
...
no_ack:
		if (eaten)
				kfree_skb_partial(skb, fragstolen);
			tcp_data_ready(sk); // 데이터가 수신 큐에 추가되었음을 알림
			return;
		}
	}
slow_path:
	...
step5:
	reason = tcp_ack(sk, skb, FLAG_SLOWPATH | FLAG_UPDATE_TS_RECENT);
	...
	/* step 7: process the segment text */
	tcp_data_queue(sk, skb); // TCP 세그먼트 옵션 및 플래그 처리, 순서대로 도착하지 않은 경우 올바른 위치에 삽입 등의 작업을 수행 

	tcp_data_snd_check(sk);
	tcp_ack_snd_check(sk);
	return;
}
```

위 내용을 이해하기 위해서는 **Fast Path 와 Slow Path** 에 대해서 알 필요가 있다.

1. **Fast Path : 가장 일반적이고, 예상되는 작업을 처리하는 최적화된 매커니즘이며 가장 일반적인 작업만 처리하기 때문에 Slow Path보다 복잡성이 덜하다.**
	+ 예시 : 패킷이 순차적으로 도착하고 모든 것이 예상대로일 경우
2. **Slow Path : 패킷 검사, 흐름 제어등 다양한 작업을 수행하다보니 Fast Path보다 느리며, 처리 과정이 상대적으로 복잡하다.**
	+ 예시 : 순서가 뒤바뀐 패킷이 도착하거나 추가 처리를 위한 특정 플래그가 설정된 경우 

위와 같이 최종적으로 데이터는 수신 큐에 적재가 되며, 실제 유저 공간에서 `recv()` 와 같은 시스템 콜이 호출될 때 `tpc_recvmsg()`[^13] 와 같은 함수에서 수신 큐에 데이터를 가져와서 데이터를 처리한다.
즉, 위에 부분은 연결 수립까지의 과정이고 데이터가 수신 큐에 적재되어 있으면,  시스템 콜에 의해서 수신 큐에 있는 데이터들을 가져가서 수신 처리를 하는 것이다.

그림으로 정리하면 아래의 플로우라고 볼 수 있다.


<p align="center">
    <img src="https://i.imgur.com/kqwfDdp.png">
</p>
<p align="center">
    <em>그림 9. Fast Path / Slow Path에 따른 TCP 메시지 수신 과정</em>
</p>


## STEP 3. TCP 사용 시 서비스에서 겪을 수 있는 문제들

자 이제 어려운 이야기들은 모두 끝냈다. 이제는 아주 편하게 볼 수 있는 내용들이고, 아마도 알고 있는 이야기들도 많을 것이다. 

중점으로 둘 내용은 `TIME_WAIT` , `CLOSE_WAIT` 소켓과 HTTP 지속 커넥션과 TCP Keep-alive 그리고, Timout에 대한 내용을 다뤄보고자 한다.

### STEP 3.1 TIME_WAIT 소켓


<p align="center">
    <img src="https://i.imgur.com/gfqildB.png">
</p>
<p align="center">
    <em>그림 10. Fast Path / Slow Path에 따른 TCP 메시지 수신 과정</em>
</p>

먼저, `TIME_WAIT` 를 알아보기 앞 서 이와 연관이 있는 4-Way Handshake 그림을 봐보자.

여기서는 서버-클라이언트라는 명칭 대신에 Active Closer와 Passive Closer라는 명칭을 사용했다. 이 뜻은 아래와 같다.

+ **Active Closer : 먼저 연결을 끊는 쪽**
+ **Passive Closer : 그 반대 쪽**

잘 보면 Active Closer 쪽에 `TIME_WAIT` 소켓이 생성되는 것을 볼 수 있다. 즉, 클라이언트에서도 `TIME_WAIT`가 생길 수 있으며, 서버쪽에서도 `TIME_WAIT`가 생길 수 있다고 보면된다.

`TIME_WAIT` 를 이해하기 앞서 우리가 봤던 핸드셰이크 과정이 제대로 이뤄지는지 확인해보자. 필자는 가상머신에 Nginx를 설치 한 후에 tcpdump를 통해서 와이어 샤크로 분석을 수행해보았다.

![](https://i.imgur.com/G1jWW7G.png)

1. 클라이언트(192.168.106.1)가 서버(192.168.106.3) 포트 80에 `SYN` 패킷을 보낸다. 
2. 서버는 클라이언트에게 `SYN+ACK` 패킷을 보낸다.  
3. 다시 클라이언트는 서버에 `ACK` 패킷을 보낸다. 

여기까지가 **3-way Handshake 과정**이다. 

---

4. 3-way Handshake가 끝난 후 클라이언트는 GET 요청을 보낸다.  
5. 서버(Active Closer)는 연결을 끊기 위해 클라이언트(Passive Closer)에게 `FIN` 패킷을 보낸다.
6. 클라이언트는 이에 대한 응답으로 `ACK` 패킷을 보낸다
7. 클라이언트는 소켓 정리 후에 서버에게 연결 종료를 위한 `FIN` 패킷을 보낸다. 
8. 서버는 클라이언트에게 `ACK` 패킷을 보낸 후 연결 종료를 한다.

여기까지가 **4-way Handshake 과정**이다.

우리가 위에서 보았던 Handshake 과정을 수행하는 것을 실제로 확인하였다. 그렇다면, `TIME_WAIT` 상태가 서비스에 어떤 영향을 끼칠 수 있을까?

우선, **소켓 포트 고갈 문제가 발생**할 수 있다. 

```sh
sysctl net.ipv4.ip_local_port_range
# net.ipv4.ip_local_port_range = 32768	60999 # MIN MAX
```

해당 커널 파라미터는 소켓의 포트의 개수를 조절하는 파라미터이다. 

현재 필자의 가상머신에서는 32768 ~ 60999까지가 해당 포트를 사용하고 있음을 확인할 수 있다.

만약, 모든 로컬 포트가 `TIME_WAIT` 상태라면, 할당할 수 있는 포트가 없기 때문에 외부와 통신을 못하게 되고 **어플리케이션에서는 타임아웃 문제가 발생**할 수 있다.

그리고 `TIME_WAIT` 가 많이 발생한다면 **TCP 자체가 잦은 연결 수립/끊음이 발생**한다고도 추정할 수 있다.

즉, Handshake가 많이 발생하면서 **전체적인 서비스의 응답 속도 저하를 야기**할 수 있다.
이러한 현상을 막기 위해서 현대의 어플리케이션에서는 커넥션 풀을 사용하여 한번 맺어 놓은 TCP를 재사용하도록 구현하고 있다. 

#### STEP 3.1.1 클라이언트 측면 

위에서 간략하게 `TIME_WAIT` 가 많이 발생할 시 문제점들을 간략히 설명했다. 서버/클라이언트 측면에서 보고자 한다.
헷갈리면 안되는 것이 `TIME_WAIT` 는 Active Closer 쪽에서 발생하는 것이기 때문에 서버와 클라이언트 모두 발생할 수 있다.

<p align="center">
    <img src="https://i.imgur.com/q2rPjqj.png">
</p>
<p align="center">
    <em>그림 11. 간단한 2tier 시스템</em>
</p>


위 그림을 보면 사용자(User)가 POST 메서드를 웹서버에 발행하는 구간은 클라이언트가 사용자고, 서버가 웹 서버일 것이다. 

그러나, DB서버와 통신하는 구간은 웹서버가 클라이언트고, DB 서버가 서버의 역할을 하게된다.

DB서버와 통신하는 구간에서 웹서버가 연결을 먼저 끊게 되면, 웹서버가 Active Closer가 될 것이고, `TIME_WAIT` 소켓이 발생할 수 있을 것이다.

소켓은 필수적인 4개의 값이 존재하는데 이를 알아보기 위해 잠깐 `struct sock_common` 구조체를 코드를 가져와보겠다.

```c
//https://github.com/torvalds/linux/blob/master/include/net/sock.h#L163
/**
* @skc_addrpair: 8-byte-aligned __u64 union of @skc_daddr & @skc_rcv_saddr
* @skc_hash: hash value used with various protocol lookup tables
* @skc_portpair: __u32 union of @skc_dport & @skc_num
**/
struct sock_common {
	union {
		__addrpair	skc_addrpair;
		struct {
			__be32	skc_daddr;
			__be32	skc_rcv_saddr;
		};
	};
	union  {
		unsigned int	skc_hash;
		__u16		skc_u16hashes[2];
	};
	/* skc_dport && skc_num must be grouped as well */
	union {
		__portpair	skc_portpair;
		struct {
			__be16	skc_dport;
			__u16	skc_num;
		};
	};
	...
}
```

+ `sck_addrpair` 는 출발지와 목적지의 IPv4 주소를 담고 있다.
+ `sck_portpair` 는 포트 번호들을 담고 있다.
+ `skc_hash` 는 소켓을 빠르기 찾기 위한 해시 값이고, 패킷이 도착했을 때 어떤 소켓에 해당하는지 알아내는데 도움을 준다. 

즉,`sck_addrpair`, `sck_portpair` 의 묶음이 해시로 생성되고 이 소켓은 **커널 내부에 유일하게 존재**하게 되고, 서두에서 본 내용처럼 FD(File Descriptor)를 전달해주는 것이다.

이러한 소켓을 active close하게 되면, `TIME_WAIT` 상태로 남게 된다. **따라서, 해당 소켓의 `TIME_WAIT` 상태가 풀리기 전까지 해당 소켓은 다시 사용할 수 없다.**

이런식으로 계속 `TIME_WAIT` 소켓이 쌓이면서 로컬 포트가 전부 고갈되어 `net.ipv4.ip_local_port_range` 값을 다 쓰게되면 통신을 할 수 없게 된다.

이를 테스트 해보자.

```sh
curl https://www.google.co.kr > /dev/null 2>&1 
netstat -napo | grep TIME_WAIT 
tcp        0      0 192.168.106.3:51292     142.250.207.99:443      TIME_WAIT   -                    timewait (8.68/0/0)
```

위의 명령은 `curl` 을 통해서 `www.google.co.kr` 에 요청을 수행한 후에 `TIME_WAIT` 가 발생하는데 이는 `curl` 자체가 요청 후에 응답을 받으면 연결을 끊는 매커니즘이 있기 때문이다.
자세한 코드는 [여기](https://github.com/curl/curl/blob/master/lib/url.c#L3895)를 확인하자.

어쨋든 간단하게 `TIME_WAIT` 를 만들 수 있게 되었고, 우리의 가설은 **동일한 소켓은 사용이 안된다는 것이었으므로 한번 이 가설을 검증**해보자.

```sh
sysctl net.ipv4.ip_local_port_range
# net.ipv4.ip_local_port_range = 32768	60999

sudo sysctl -w "net.ipv4.ip_local_port_range=32768 32768" # 인터넷 소켓의 포트 범위를 32768 한개로 줄임
# net.ipv4.ip_local_port_range = 32768 32768

curl https://www.google.co.kr > /dev/null 2>&1
netstat -napo | grep TIME_WAIT
# (Not all processes could be identified, non-owned process info
# will not be shown, you would have to be root to see it all.)
# tcp        0      0 192.168.106.3:32768     142.250.207.99:443      TIME_WAIT   -                    timewait (51.57/0/0)

curl https://www.google.co.kr > /dev/null
#  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
#                                 Dload  Upload   Total   Spent    Left  Speed
#  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0 curl: (7) Couldn't connect to server
```

+ `sudo sysctl -w "net.ipv4.ip_local_port_range=32768 32768"` 로 포트 범위를 제한한다.
+ 똑같은 요청 시에 `curl: (7) Couldn't connect to server` 에러가 발생하는 것을 볼 수 있다.

이렇게, 우리의 가설을 검증할 수 있는 것을 확인할 수 있다.

그렇다면 이러한 포트 고갈에 어떻게 대응할 수 있는 방법이 뭐가 있을까? 바로, `net.ipv4.tcp_tw_reuse` 파라미터를 사용할 수 있다. 

```sh
sysctl net.ipv4.tcp_tw_reuse
# net.ipv4.tcp_tw_reuse = 0

sudo sysctl -w "net.ipv4.tcp_tw_reuse=1"
# net.ipv4.tcp_tw_reuse = 1

curl https://www.google.co.kr > /dev/null
#  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
#                                 Dload  Upload   Total   Spent    Left  Speed
#100 18649    0 18649    0     0  59007      0 --:--:-- --:--:-- --:--:-- 59203
curl https://www.google.co.kr > /dev/null
#  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
#                                 Dload  Upload   Total   Spent    Left  Speed
#100 18624    0 18624    0     0  56613      0 --:--:-- --:--:-- --:--:-- 56607
curl https://www.google.co.kr > /dev/null
#  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
#                                 Dload  Upload   Total   Spent    Left  Speed
# 100 18594    0 18594    0     0  58303      0 --:--:-- --:--:-- --:--:-- 58288
```

해당 `net.ipv4.tcp_tw_reuse` 를 enable 할 경우에 계속적으로 요청을 할 수 있다. 아래는 해당 파라미터의 동작 원리이다.

<p align="center">
    <img src="https://i.imgur.com/90rafkG.png">
</p>
<p align="center">
    <em><a href="https://www.yes24.com/Product/Goods/44376723">그림 12. net.ipv4.tcp_tw_reuse 파라미터 동작 원리, DevOps와 SE를 위한 리눅스 커널 이야기(강진우 저), 2017</a></em>
</p>




하지만, 위 방식은 궁여지책일 뿐 근본적인 해결책은 아니라고 볼 수 있다. 그렇다면, 어떻게 이 문제를 해결할 수 있을까? 바로 **Connection Pool** 을 사용하는 것이다. 

> ❗❗ 중요 
>  궁여지책이라해서 상기 파라미터(`net.ipv4.tcp_tw_reuse`)를 꺼도 무방하다라는 뜻은 아니다. 
>  실제로 필자가 포스팅을 위해 세팅한 가상환경은 ubuntu 22.04 버전으로, 커널은 5.15.0-84 버전을 사용중이다. 
>  이 커널 버전에서는 해당 **파라미터가 default로 활성화**되어있다. 
>  
>  따라서, 궁여지책이라는 말의 뜻은 `TIME_WAIT` 소켓이 다수 발생 시 소켓 재사용만으로는 한계가 존재하며, **클라이언트 어플리케이션이 Connection Pool을 사용하는지 확인한 후 사용하지 않는 상황이라면 해당 방법을 적용하라는 뜻**이다.


<p align="center">
    <img src="https://i.imgur.com/NaZDtxa.png">
</p>
<p align="center">
    <em><a href="https://www.yes24.com/Product/Goods/44376723">그림 13. Connection Less와 Connection Pool, DevOps와 SE를 위한 리눅스 커널 이야기(강진우 저), 2017</a></em>
</p>

Connection Less 방식은 우리가 위에서 살펴봤던 방식이고, Connection Pool은 소켓을 미리 열어둬서 불필요한 TCP 연결 수립/종료 과정이 없어서 응답속도를 높힐 수 있다.

실제로, Connection Pool 사용 시 `TIME_WAIT` 가 줄어드는 지 궁금하지 않는가? 이에 대한 또 가설 검증을 진행해보자. 필자는 가상머신에 Docker를 설치하여 Redis를 구동시킨 후 `setex` 라는 커맨드를 요청하는 식의 스크립트를 작성하였다.

+ Connection Less 방식 

```sh
#!/usr/bin/python
import redis
import time

count = 0
while True:
    if count > 10000:
        break;
    r = redis.Redis(host='localhost', port=6379, db=0)
    print("SET")
    r.setex(count, 10, count)
```

+ Connection Pool 방식

```sh
#!/usr/bin/python
import redis
import time

count = 0
pool = redis.ConnectionPool(host='localhost', port=6379, db=0) # Redis Client를 이용하여 Connection Pool을 생성한다.
while True:
    if count > 10000:
        break;
    r = redis.Redis(connection_pool=pool) # 실제 연결 시 Connection Pool을 이용한다.
    print("SET")
    r.setex(count,10,count)
```

+ 결과 

```sh
# Connection Less 방식 사용 시 
netstat -napo | grep -i 6379
(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
tcp        0      0 0.0.0.0:6379            0.0.0.0:*               LISTEN      -                    off (0.00/0/0)
tcp        0      0 127.0.0.1:51674         127.0.0.1:6379          TIME_WAIT   -                    timewait (54.92/0/0)
tcp        0      0 172.17.0.1:52260        172.17.0.2:6379         TIME_WAIT   -                    timewait (54.63/0/0)
tcp        0      0 172.17.0.1:53776        172.17.0.2:6379         TIME_WAIT   -                    timewait (46.52/0/0)
tcp        0      0 127.0.0.1:55084         127.0.0.1:6379          TIME_WAIT   -                    timewait (51.01/0/0)
tcp        0      0 127.0.0.1:40166         127.0.0.1:6379          TIME_WAIT   -                    timewait (48.72/0/0)
tcp        0      0 172.17.0.1:56876        172.17.0.2:6379         TIME_WAIT   -                    timewait (55.27/0/0)
tcp        0      0 172.17.0.1:47876        172.17.0.2:6379         TIME_WAIT   -                    timewait (58.18/0/0)
tcp        0      0 127.0.0.1:55660         127.0.0.1:6379          TIME_WAIT   -                    timewait (59.46/0/0)
tcp        0      0 172.17.0.1:52602        172.17.0.2:6379         TIME_WAIT   -                    timewait (54.67/0/0)
tcp        0      0 127.0.0.1:55284         127.0.0.1:6379          TIME_WAIT   -                    timewait (51.03/0/0)
tcp        0      0 172.17.0.1:51382        172.17.0.2:6379         TIME_WAIT   -                    timewait (54.50/0/0)
tcp        0      0 172.17.0.1:38266        172.17.0.2:6379         TIME_WAIT   -                    timewait (58.60/0/0)
tcp        0      0 172.17.0.1:43192        172.17.0.2:6379         TIME_WAIT   -                    timewait (59.50/0/0)
tcp        0      0 127.0.0.1:36864         127.0.0.1:6379          TIME_WAIT   -                    timewait (52.60/0/0)
tcp        0      0 172.17.0.1:37414        172.17.0.2:6379         TIME_WAIT   -                    timewait (52.27/0/0)
tcp        0      0 172.17.0.1:33792        172.17.0.2:6379         TIME_WAIT   -                    timewait (51.68/0/0)
tcp        0      0 127.0.0.1:59636         127.0.0.1:6379          TIME_WAIT   -                    timewait (51.70/0/0)
tcp        0      0 127.0.0.1:33870         127.0.0.1:6379          TIME_WAIT   -                    timewait (52.10/0/0)
tcp        0      0 172.17.0.1:51496        172.17.0.2:6379         TIME_WAIT   -                    timewait (50.07/0/0)
...

# Connection Pool 방식 사용 시
netstat -napo | grep -i 6379
(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
tcp        0      0 0.0.0.0:6379            0.0.0.0:*               LISTEN      -                    off (0.00/0/0)
tcp        5      0 172.17.0.1:45724        172.17.0.2:6379         ESTABLISHED -                    keepalive (5.72/0/0)
tcp        0      0 127.0.0.1:6379          127.0.0.1:43862         ESTABLISHED -                    keepalive (5.71/0/0)
tcp        5      0 127.0.0.1:43862         127.0.0.1:6379          ESTABLISHED 3525/python3         off (0.00/0/0)
tcp6       0      0 :::6379                 :::*                    LISTEN      -                    off (0.00/0/0)
```

위와 같이 많은 차이를 가짐을 확인할 수 있다.  하지만, Connection Pool 방식에도 단점이 존재하는데 이는 TCP Keep-alive와 관련있으므로 후에 살펴보도록 한다.

#### STEP 3.1.2 서버 측면 

이제는 Active Closer가 서버인 상황에 대해서 알아보자. 클라이언트와 다르게, 서버는 소켓을 열어두고 요청을 받는 입장이라 로컬 포트 고갈의 문제는 없다.
하지만, `TIME_WAIT` 소켓이 자주 발생하면 클라이언트에서 발생하는 문제처럼 불필요한 Handshake가 잦아질 수 있다.

그렇다면, 서버에서는 어떤 경우에 `TIME_WAIT`가 발생할 수 있을까? 위에서 필자는 Nginx를 설치해두었는데 여기서 `keepalive_timeout` 값을 0으로 둬보겠다.

```json
server {
        keepalive_timeout 0; // 추가
        listen 80 default_server;
        listen [::]:80 default_server;
        ...
}
```

이후, 클라이언트에서 해당 Nginx로 요청을 보내보겠다.

```sh
curl -s http://192.168.106.3 > /dev/null # 여러번 돌린다. (클라이언트 터미널이여야 함)


netstat -napo | grep -i :80 # 서버 터미널에서 TIME_WAIT를 아래와 같이 확인할 수 있다.
(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN      -                    off (0.00/0/0)
tcp        0      0 192.168.106.3:80        192.168.106.1:50610     TIME_WAIT   -                    timewait (9.64/0/0)
tcp        0      0 192.168.106.3:80        192.168.106.1:50607     TIME_WAIT   -                    timewait (8.27/0/0)
tcp        0      0 192.168.106.3:80        192.168.106.1:50608     TIME_WAIT   -                    timewait (8.70/0/0)
tcp        0      0 192.168.106.3:80        192.168.106.1:50605     TIME_WAIT   -                    timewait (7.75/0/0)
tcp        0      0 192.168.106.3:80        192.168.106.1:50609     TIME_WAIT   -                    timewait (9.16/0/0)
tcp        0      0 192.168.106.3:80        192.168.106.1:50632     TIME_WAIT   -                    timewait (42.12/0/0)
tcp        0      0 192.168.106.3:80        192.168.106.1:50611     TIME_WAIT   -                    timewait (10.08/0/0)
tcp6       0      0 :::80                   :::*                    LISTEN      -                    off (0.00/0/0)
```

보면, 호스트 컴퓨터(클라이언트, `192.168.106.1`) 에서 가상 머신(서버, `192.168.106.3`)으로 요청이 보내진 뒤에 keep-alive 옵션이 꺼져있으므로 응답을 내려준 후에 연결을 해제하므로 해당 소켓들이 `TIME_WAIT` 상태임을 확인할 수 있다.

> 💡 참고 
> 책에서는 이를 해결하는 방법 중에 하나로 `net.ipv4.tcp_tw_recycle` 커널 파라미터를 활성화하는 것에 대해서 나오지만, **4.12 이후 커널**부터는 제거가 되었다. 
> 제거된 이유에 대해서는 밑에서 설명하겠지만, 해당 커밋 내용에 대해서 궁금하면 [여기](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=4396e46187ca5070219b81773c4e65088dac50cc) 를 참고해보기 바란다. 

이전에는 `net.ipv4.tcp_tw_recycle` 파라미터를 활성화하여 해결할 수 있었지만 이는 치명적인 단점이 존재한다.

`net.ipv4.tcp_tw_recycle` 파라미터는 서버 입장에서 소켓을 빠르게 회수하고 재활용할 수 있는 기능이다. 

해당 커널 파라미터가 활성화되면 동작 방식은 아래와 같다.
1. 가장 마지막에 해당 소켓으로부터 들어온 Timestamp 저장
2. `TIME_WAIT` 소켓의 타이머를 RTO(Retransmission Timeout)[^14] 기반의 값으로 변경 

RTO 는 대부분 ms 단위기에 `TIME_WAIT` 가 줄어들지만, 1번의 동작 방식때문에 아래의 문제가 발생할 수 있다.


<p align="center">
    <img src="https://i.imgur.com/IbwwDRm.png">
</p>
<p align="center">
    <em><a href="https://www.yes24.com/Product/Goods/44376723">그림 14. tcp_tw_recycle 파라미터 활성화 시 발생하는 문제, DevOps와 SE를 위한 리눅스 커널 이야기(강진우 저), 2017</a></em>
</p>

같은 NAT 상에 존재하는 클라이언트 C1, C2가 존재한다고 가정해보자. 그렇다면, 서버인 S 입장에서는 같은 클라이언트로 보게 된다.

1. S가 C1의 요청을 종료하기 위해 4-way Handshake 수행
2. `TIME_WAIT` 소켓 발생 시 RTO 값으로 세팅하여 금방 정리한 후 C1이 보낸 FIN 패킷의 Timestamp 저장
3. $C2_{timestamp} < C1_{timestamp}$ 인 경우, **동일한 클라이언트에서 Timestamp가 더 작은 요청이 발생했으므로 패킷을 처리하지않고 버림.**
4. C2는 S로부터 `ACK` 을 받지 못하므로 계속 재전송한다.

즉, NAT 환경에서의 다양한 클라이언트가 있을 때 **항상 Timestamp가 단조증가한다는 보장이 없으므로 이는 치명적인 문제를 야기**한다. **(이것이 4.12버전에서 해당 파라미터가 제거된 원인이다.)**

이를 해결해서 사용하는 것이 바로 **keep-alive** 옵션이다.

서버에서 발생하는 `TIME_WAIT` 에 대한 검증을 위해 필자는 Nginx에 `keepalive_timeout 0;` 와 같이 처리하였는데 이 값을 30초로 바꾸고 동작시켜보자.

```sh
sudo systemctl reload nginx
netstat -napo | grep -i :80
#(Not all processes could be identified, non-owned process info
# will not be shown, you would have to be root to see it all.)
#tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN      -                    off (0.00/0/0)
#tcp6       0      0 :::80                   :::*                    LISTEN      -                    off (0.00/0/0)
```

`TIME_WAIT` 소켓이 깔끔하게 제거된 것을 볼 수 있다. keep-alive는 요청을 끝마쳐도 해당 타임아웃 내까지는 연결이 끊어지지 않으므로 계속 연결이 되어있다고 보면된다.
따라서, 30초 이후에 `TIME_WAIT` 소켓이 발생할 것이다.

> ❗❗ 중요 
>  여기서 Nginx로 설정한 `keepalive_time 30;` 과 같은 keep-alive는 HTTP/1.1의 지속커넥션[^15] 에 해당한다.
>  TCP에도 keep-alive가 존재하는데 혼동해서는 안된다. TCP keep-alive는 밑에서 다룰 예정이다.

#### STEP 3.1.3 TIME_WAIT 소켓의 존재 의의

위에서 간략하게 클라이언트의 측면과 서버 측면에서 살펴보았다. 

결국, `TIME_WAIT`가 자주 발생하면 Handshake가 잦아져서 성능 저하가 일어날 수 있다는 것도 알게되었다.

그러면, 왜 불편하게 이러한 상태를 만들었을까? 

4-way Handshake를 다시 떠올려보자. 결국, Passive Closer는 소켓을 닫기 위해서 `LAST_ACK`을 Active Closer쪽에서 받아야한다.

만약, `TIME_WAIT` 가 없이 바로 정리를 하게 된다면 `ACK`을 Passive Closer쪽 전달을 못할 것이고, 그렇다면 클라이언트 소켓 정리가 이뤄지지 않을 것이다.

즉, `TIME_WAIT`가 없다면 Passive Closer쪽에는 `LAST_ACK` 상태인 소켓이 많이 쌓일 수 있을 것이다.

추가로, 네트워크 문제로 Active Closer가 `ACK` 을 보냈지만 유실되어도 Passive Closer 쪽에서 다시 `FIN` 을 보내면 정상 연결종료 처리가 가능할 것이다.

결론적으로, **연결 종료에 어느정도 유예를 줘서 바로 연결 종료했을 경우에 발생할 수 있는 문제점들을 해결하는 중요한 소켓**이라 볼 수 있다.

### STEP 3.3 TCP Keep-Alive 

이번에는 TCP keep-alive에 대해서 다뤄보고자 한다. 

위에서 본 Nginx의 keep-alive와 비슷하게, TCP keep-alive도 너무 잦은 3-way Handshake를 줄이기 위해, 두 TCP 소켓끼리 지속적으로 세션을 유지하는 기법이다.

TCP keep-alive는 3-way Handshake 이후에 수립된 세션끼리 주기적으로 작은 양의 패킷을 보내 세션을 유지한다.

현재, 우리가 OS 상에 사용 중인 인터넷 소켓이 keep-alive를 지원하는지 보기위해서는 `netstat` 로 확인할 수 있다.

```sh
netstat -napo
#(Not all processes could be identified, non-owned process info
# will not be shown, you would have to be root to see it all.)
# Active Internet connections (servers and established)
# Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name     Timer
#tcp        0      0 127.0.0.53:53           0.0.0.0:*               LISTEN      -                    off (0.00/0/0)
#tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN      -                    off (0.00/0/0)
#tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      -                    off (0.00/0/0)
#tcp        0      0 0.0.0.0:6379            0.0.0.0:*               LISTEN      -                    off (0.00/0/0)
tcp        0      0 192.168.106.3:22        192.168.106.1:64216     ESTABLISHED -                    keepalive (5652.84/0/0)
tcp        0      0 192.168.106.3:22        192.168.106.1:49449     ESTABLISHED -                    keepalive (6759.23/0/0)
#tcp6       0      0 :::80                   :::*                    LISTEN      -                    off (0.00/0/0)
#tcp6       0      0 :::22                   :::*                    LISTEN      -                    off (0.00/0/0)
#tcp6       0      0 :::6379                 :::*                    LISTEN      -                    off (0.00/0/0)
#udp        0      0 127.0.0.53:53           0.0.0.0:*                           -                    off (0.00/0/0)
#udp        0      0 192.168.106.3:68        0.0.0.0:*                           -                    off (0.00/0/0)
#raw6       0      0 :::58                   :::*                    7           -                    off (0.00/0/0)
```

필자 가상환경에서는 SSH 사용하는 부분에 대한 소켓이 keep-alive로 동작하는 것을 볼 수 있다. keepalive 뒤에 숫자는 타이머의 남은 시간이다.

위에서 설명한 것과 같이 이 타이머의 시간이 다 쓰게되면, 작은 패킷을 보내서 살아있는지를 확인한다.

그렇다면, keep-alive한 소켓은 어떻게 생성할까? 유저 공간에서 `setsockopt()`[^16] 이라는 시스템 콜을 호출 시 인자 중에 `optname` 을 통해서 keep-alive 소켓을 생성할 수 있다. 
 
인자를 `SO_KEEPALIVE` 에 해당하는 값으로 전달하면 keep-alive 소켓이 생성되며, 커널 공간 내부적으로 `struct sock_common` 쪽에 `sck_flag`라는 값에 `SO_KEEPALIVE` 플래그가 설정되어 세팅된다.

```c
//https://github.com/torvalds/linux/blob/master/include/net/sock.h#L211
/**
 *	@skc_flags: place holder for sk_flags
 *		%SO_LINGER (l_onoff), %SO_BROADCAST, %SO_KEEPALIVE,
 *		%SO_OOBINLINE settings, %SO_TIMESTAMPING settings
 **/
struct sock_common {
	...
	union {
		unsigned long	skc_flags;
		struct sock	*skc_listener; /* request_sock */
		struct inet_timewait_death_row *skc_tw_dr; /* inet_timewait_sock */
	};
}
```

현대의 어플리케이션에서는 대부분 TCP keep-alive 설정을 할 수 있는 별도 옵션을 제공하는데 필자는 Redis를 활용해보겠다.

```sh
telnet 127.0.0.1 6379 # 별도 터미널에서 수행 (연결하기 위함)

netstat -napo | grep -i :6379 | grep -i est
(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
tcp        0      0 127.0.0.1:42396         127.0.0.1:6379          ESTABLISHED 7810/telnet          off (0.00/0/0)
tcp        0      0 127.0.0.1:6379          127.0.0.1:42396         ESTABLISHED -                    off (0.00/0/0)
```


레디스는 3.2.1 부터 default로 `tcp-keepalive` 옵션이 300으로 설정되어있다. 따라서, 위 그림은 0으로 세팅한 후 본 결과라 생각하면 된다.


```sh
127.0.0.1:6379> config get tcp-keepalive
1) "tcp-keepalive"
2) "0"

127.0.0.1:6379> config set tcp-keepalive 300
OK

127.0.0.1:6379> config get tcp-keepalive
1) "tcp-keepalive"
2) "300"


netstat -napo | grep -i :6379 | grep -i est
(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
tcp        0      0 127.0.0.1:51032         127.0.0.1:6379          ESTABLISHED 7843/telnet          off (0.00/0/0)
tcp        0      0 127.0.0.1:6379          127.0.0.1:51032         ESTABLISHED -                    keepalive (297.74/0/0)
```

위와 같이 keep-alive 설정을 통해서 타이머가 가고 있는 것을 확인할 수 있다. 이를 실제로 덤프를 떠서 와이어샤크로 확인하면 아래와 같은 내용을 볼 수 있다.

![](https://i.imgur.com/08Pd1ws.png)

우리가 예상했던 것과 같이 주기적으로 keep-alive 패킷을 보내고 있다. 필자는 이 덤프를 뜨기 위해서 `tcp-keepalive` 값을 10으로 선언하였고, 10초마다 keep-alive 패킷과 keep-alive ACK 패킷이 발생하는 것을 볼 수 있다.

#### STEP 3.3.1 TCP Keep-Alive 파라미터

위에서는 TCP keep-alive가 무엇이고, 동작 원리는 어떻게 되는가를 확인하였다. 그렇다면 이와 관련된 커널 파라미터는 어떤 것들이 있을까?

```sh
sudo sysctl -a | grep -i keepalive
net.ipv4.tcp_keepalive_intvl = 75
net.ipv4.tcp_keepalive_probes = 9
net.ipv4.tcp_keepalive_time = 7200
```

1. `net.ipv4.tcp_keepalive_intvl` : **keep-alive 패킷을 보내는 주기**, `net.ipv4.tcp_keepalive_time`이 지난 후 확인 패킷을 보내게 되는데, 응답이 없으면 몇 초 후에 재전송 패킷을 보낼지 정의
2. `net.ipv4.tcp_keepalive_probes` : k**eep-alive 패킷을 보낼 최대 전송 횟수**를 정의, 다양한 원인으로 인해서 패킷 유실이 될 수 있으므로 재전송 매커니즘이 필요한데 최대 재전송 횟수를 정의한다.
3. `net.ipv4.tcp_keepalive_time` : **keep-alive 소켓의 유지시간**이며, 최소한 7200초를 유지한다. 타이머는 이 시간을 기준으로 동작한다. (Redis 예시와 같이 이 값은 지정 가능하다.)

그림으로 보면 아래와 같다.

<p align="center">
    <img src="https://i.imgur.com/pOF6AWj.png">
</p>
<p align="center">
    <em><a href="https://www.yes24.com/Product/Goods/44376723">그림 15. TCP Keep-Alive 파라미터 동작 원리, DevOps와 SE를 위한 리눅스 커널 이야기(강진우 저), 2017</a></em>
</p>


#### STEP 3.3.2 좀비 커넥션 

위에서 TCP keep-alive 동작 매커니즘과 keep-alive 커널 파라미터등을 보았다. 

이를 통해서 불필요한 Handsahke를 줄여 서비스의 품질을 높이는 효과도 있지만, 더 큰 효과는 **좀비 커넥션 방지**이다.

좀비 커넥션은 **두 개의 세션 중에서 하나가 종료를 했음에도 다른 한쪽이 계속 살아있는 비정상적인 커넥션**을 뜻한다.

이에 대한 검증을 수행해보자. 이를 위해 Mysql을 사용할 것인데, 아래의 간단한 스크립트를 사용해보자. 

```sh
#!/usr/bin/python
# -*- coding: utf-8 -*-
import pymysql
import sys
import time
from datetime import datetime

con = pymysql.connect(host='localhost', user='root', password='root', db='mysql', charset='utf8');

while True:
    cur = con.cursor()
    cur.execute("SELECT VERSION()")
    ver = cur.fetchone()
    print("Database version : %s " % ver)
    time.sleep(600)
```

+ mysqld가 정상적으로 종료되는 케이스

```sh
# 파이썬 코드를 수행 후 초기 상황 
netstat -napo | grep -i :3306
(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
tcp        0      0 0.0.0.0:3306            0.0.0.0:*               LISTEN      -                    off (0.00/0/0)
tcp        0      0 172.17.0.1:50404        172.17.0.2:3306         ESTABLISHED -                    keepalive (6.64/0/0)
tcp        0      0 127.0.0.1:33354         127.0.0.1:3306          ESTABLISHED 26338/python3        keepalive (7176.40/0/0)
tcp        0      0 127.0.0.1:3306          127.0.0.1:33354         ESTABLISHED -                    keepalive (6.64/0/0)
tcp6       0      0 :::3306                 :::*                    LISTEN      -                    off (0.00/0/0)

# Mysql 서버를 정상 종료 시에 상황 
netstat -napo | grep -i :3306
(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
tcp        1      0 127.0.0.1:33354         127.0.0.1:3306          CLOSE_WAIT  26338/python3        keepalive (7042.06/0/0)
tcp        0      0 127.0.0.1:3306          127.0.0.1:33354         FIN_WAIT2   -                    timewait (54.04/0/0)
```

Mysql을 가동하고 위 스크립트를 동작시켰을 시에 초기에는 `ESTABLISHED` 상태임을 확인할 수 있다. 이후, `docker stop mysql` 을 통해서 정상 종료를 시켰다.

그 이후에 클라이언트의 상태가 `CLOSE_WAIT`가 되었음을 확인할 수있다. 즉, `FIN` 패킷이 정상적으로 클라이언트에 수신된 것이다.

+ 비정상적인 동작으로 연결 패킷이 유실되는 경우

이번 시나리오는 강제로 `iptables`를 활용하여 모든 패킷을 DROP 시켜보는 상황이다. 다시 Mysql 서버를 가동 후에 스크립트를 돌린 후에 아래의 명령어를 수행해보자.

```sh
# 정상 연결 수립 상황 
netstat -napo | grep -i :3306
(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
tcp        0      0 0.0.0.0:3306            0.0.0.0:*               LISTEN      -                    off (0.00/0/0)
tcp        0      0 127.0.0.1:36210         127.0.0.1:3306          ESTABLISHED 26760/python3        keepalive (7196.60/0/0)
tcp        0      0 127.0.0.1:3306          127.0.0.1:36210         ESTABLISHED -                    keepalive (11.60/0/0)
tcp        0      0 172.17.0.1:52948        172.17.0.2:3306         ESTABLISHED -                    keepalive (11.61/0/0)
tcp6       0      0 :::3306                 :::*                    LISTEN      -                    off (0.00/0/0)

# 클라이언트 소켓으로 나가는 패킷을 전부 드랍 후 Mysql 서버 종료 
sudo iptables -A OUTPUT -p tcp -d 127.0.0.1 -j DROP
docker stop mysql

# 이후 상황
netstat -napo | grep -i :3306
(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
tcp        0      0 127.0.0.1:36210         127.0.0.1:3306          ESTABLISHED 26760/python3        keepalive (7119.27/0/0)
tcp        0      1 127.0.0.1:3306          127.0.0.1:36210         FIN_WAIT1   -                    probe (0.89/0/4)
```

보면, 여전히 `ESTABLISHED` 상태임을 확인할 수 있다. 필자의 가상머신의 `net.ipv4.tcp_keepalive_time` 값은 7200초라 디폴트로 7200초부터 타이머가 흐르는 것도 확인할 수 있다. 

우리가 위에서 본 내용처럼 실제로 `net.ipv4.tcp_keepalive_intvl` 이후마다 keep-alive 패킷을 보내고 `net.ipv4.tcp_keepalive_probes` 에 명시된 최대 재전송 이후에 이 커넥션이 종료가 될까? 이를 위해 TCP 덤프를 떠보겠다.

필자는 좀 더 빠르게 상황을 재현하기 위해 아래와 같이 커널 파라미터를 변경하였다.
+ `net.ipv4.tcp_keepalive_intvl` : 10
+ `net.ipv4.tcp_keepalive_probes` : 5 
+ `net.ipv4.tcp_keepalive_time` : 10

```sh
# 비정상 종료로 인하여 ESTABLISHED 상태로 남아있으나, probe 값이 증가가 되고 있는 것을 확인할 수 있음
netstat -napo | grep -i :3306
(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
tcp        0      1 127.0.0.1:3306          127.0.0.1:49424         FIN_WAIT1   -                    probe (18.34/0/7)
tcp        0      0 127.0.0.1:49424         127.0.0.1:3306          ESTABLISHED 1357/python3         keepalive (9.65/0/4)


# 설정된 probe 값만큼 패킷 재전송 후 클라이언트 소켓이 정리된 상황 (좀비커넥션 정리 완료)
 netstat -napo | grep -i :3306
(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
tcp        0      1 127.0.0.1:3306          127.0.0.1:49424         FIN_WAIT1   -                    probe (51.70/0/8)
```

즉, 우리가 알아봤던 내용대로 동작하는 것을 확인할 수 있다.

#### STEP 3.3.3 HTTP 지속커넥션 vs TCP Keep-Alive

위에서 우리가 잠깐 Nginx를 통해서 `keepalive_timeout`옵션을 건드려서 `TIME_WAIT` 소켓을 많이 생성하는 부분들을 보았다.
그런데 그 부분에서 필자는 이 부분은 TCP keep-alive와는 다르다고 했다. 사실, Nginx에서 사용하는 부분은 HTTP/1.1의 지속커넥션[^15] 에 해당한다.

두 가지의 차이점은 아래와 같다.
+ TCP Keep-Alive : **네트워크 상의 장애나 일시적인 문제로 인해 연결이 끊어졌는지 확인하기 위한 메커니즘이며, 연결이 유효한지 주기적으로 확인하는 방식**
+ HTTP 지속커넥션 : **응답 이후 TCP 연결을 닫지 않고, 일정 시간동안 기다려서 하나의 TCP로 다양한 요청/응답을 처리하는 매커니즘.**

HTTP 지속커넥션은 위에서 본 Connection Pool과 비슷하다고 볼 수도 있다. 이를 이해하기 위해서는 HTTP/1.0에 대해서 설명이 필요하다.
HTTP/1.0에서는 매 요청마다 새로운 TCP 소켓을 생성했다. 그러다보니 매 요청마다 Handshake가 발생했다. 그러나, 웹이 처리하는 정보들이 복잡해지면서 많은 요청/응답들이 생겨났면서 오버헤드가 가파르게 증가했다.
이러한 문제때문에 HTTP/1.1부터는 지속커넥션을 도입해서 연결 수립 이후 해당 소켓을 재활용하여 오버헤드를 줄인 것이다.

그렇다면 두 값이 다를 경우에는 어떻게 처리가 될까?

2가지 시나리오가 있을 수 있다.

1. $HTTP_{Persistence\,Conenction} > TCP_{Keep-Alive}$ : HTTP 지속커넥션 Timeout이 TCP Keep-Alive Timeout 값보다 큰 경우
2. $HTTP_{Persistence\,Conenction} < TCP_{Keep-Alive}$ : HTTP 지속커넥션 Timeout이 TCP Keep-Alive Timeout 값보다 작은 경우 

이 두개의 시나리오는 그림으로 보는 것이 좋을 것 같다.

+ $HTTP_{Persistence\,Conenction} > TCP_{Keep-Alive}$ 경우 

![](https://i.imgur.com/I4NkfSr.png)

+ HTTP Keep-Alive Timeout : 60초
+ TCP Keep-Alive Timeout : 30초

30초 마다 TCP Keep-Alive는 패킷을 보내 살아있는지 여부를 확인하고, 다시 타이머를 초기화한다. 
60초가 되었을 시점에는 HTTP Keep-Alive 타임아웃이 발생하고, 서버가 먼저 클라이언트와의 연결을 종료한다. 

+ $HTTP_{Keep-Alive} < TCP_{Keep-Alive}$ 경우 

![](https://i.imgur.com/iQWwnVa.png)

+ HTTP Keep-Alive Timeout : 30초
+ TCP Keep-Alive Timeout : 60초

30초가 되었을 시점에는 HTTP Keep-Alive 타임아웃이 발생하고, 서버가 먼저 클라이언트와의 연결을 종료한다. 이때, TCP Keep-Alive Timeout이 60초지만 종료 요청을 받은 후 정리가 같이 된다.

결론적으로 **HTTP 지속커넥션이 설정되어있다면 해당 설정값에 맞춰 동작한다고 보면 될 것**이다. 따라서, 이 값이 다르다고 걱정하지 않아도 된다.


#### STEP 3.3.4 로드 밸런서와 TCP Keep-Alive

저자인 진우님께서는 책에 MQ 서버와 로드 밸런서에서 생긴 사례를 공유해주셨다.

![](https://i.imgur.com/zgECd9A.png)



위 그림을 간단히 설명하면 아래와 같을 것이다.

1. Client가 로드밸런서(LB)에 연결 수립요청을 보냄
2. 로드밸런서는 MQ(1010.10.11)에 연결 수립을 한 후 세션테이블에 클라이언트 IP와 포트, 서버 IP와 포트를 기록해둔다.
3. 로드밸런서로 부터 연결 수립요청을 받은 MQ는 클라이언트에게 바로 `SYN+ACK` 패킷으로 응답한다. 

그림을 보면 `SYN+ACK` 은 로드밸런서를 거치지않고, 바로 클라이언트에게 보내지는데 대부분의 로드밸런서가 DSR(Direct Server Return)[^17] 방식을 따르기 때문이다.

이 부분은 얼핏보면 문제가 없어보인다. 하지만, 세션테이블은 무한정 늘어날 수 없고, 일정 주기로 비워진다. 이 주기가 Idle Timeout이다.
이 Idle Timeout때문에 문제가 발생할 수 있는데 세션테이블은 지워졌는데 클라이언트가 또 요청을 할 수 있다. 이 경우에 로드밸런서의 라운드로빈 정책에 따라 새로운 서버로 요청이 인입될 수 있다.

이 상황은 아래 그림과 같다.

![](https://i.imgur.com/UZfDqIs.png)



기존 MQ가 아닌 다른 MQ에 요청이 전달되었고, 이 MQ는 Handshake 맺지 않은 상태기때문에 비정상적인 패킷이라 생각하여 RST패킷을 보낸다. 
아주 운이 좋게 클라이언트가 기존에 연결되었던 MQ와 연결이 되면 문제가 없을 수 있지만, 그렇지 않은 경우에는 클라이언트 입장에서는 Timeout이 발생하게 된다. 

이런 문제가 발생하면 클라이언트는 새로운 커넥션을 열어서 새로운 서버와 연결한다. 그런데, **기존 클라이언트와 연결되어있던 서버는 이러한 행동을 알 수가 없고 이에 좀비 커넥션이 다량으로 발생**하게 된다.

그렇다면, 이를 어떻게 해결할 수 있을까? 우리는 이 해결책을 위에서 좀비 커넥션 얘기를 하면서 다뤘었다. 바로 **TCP Keep-Alive 옵션**이다.

책의 저자인 진우님께서는 로드밸런서의 Idle Timeout은 120초인 상황이었고, 120초 내에 Keep-Alive Timeout을 식별하도록 파라미터를 수정하여 해당 케이스를 해결하였다한다.


### STEP 3.4 TCP 재전송과 타임아웃


이제 TCP의 마지막 내용인 재전송과 타임아웃을 볼 차례이다. 

TCP 패킷이 유실이 발생할 수 있는 부분은 언제일까? 이 질문에 대한 답은 2가지로 볼 수 있다.

1. 연결 수립 과정 시
2. 연결 수립 이후 통신 시 

이 두 가지로 볼 수 있다. TCP는 UDP와 다르게 **신뢰성있는 프로토콜**이라고 많이들 얘기한다.
아마도, 이 포스팅을 보는 저자들도 이 개념에 대해서는 알고 있을 것이라 생각한다. 이 신뢰성을 보장하기 위해서 요청한 후 이 요청이 올바르게 갔다는 뜻으로 `ACK` 을 보낸다. 

하지만 이 `ACK`이 유실되는 경우에는 어떻게 통신이 이뤄질까? 이때, 바로 요청을 재전송하게 된다. 그렇다면, 기다리는 기준이 있을 것인데 이 기준은 어떻게 될까?

위 포스팅에서도 잠깐 `net.ipv4.tcp_tw_recycle`을 다룬 개념이 있는데 바로, RTO(Retransmission Timeout)[^14] 이다. 

RTO 또한, 2가지 종류가 있다. 

1. 연결 수립 이전에 `ACK` 수신에 대한 기준 값 : InitRTO ([RFC6298](https://datatracker.ietf.org/doc/html/rfc6298)에 따라서 1초로 설정되어있음)
2. 연결 수립 이후 `ACK` 수신에 대한 기준 값 : 일반적인 RTO 


즉, 연결 수립 이전에 패킷 손실 여부를 파악하기 위해서는 InitRTO가 1초로 설정 되어있기 때문에 최소한 1초는 기다려야 손실 여부를 파악할 수 있다.
그렇다면, 일반적인 RTO는 어떻게 정해질까? 이는 [RFC6298](https://datatracker.ietf.org/doc/html/rfc6298) 2.2에 잘 나와있다.

한번, RTT가 측정되면 아래와 같이 처리된다.

$$
\begin{matrix}
given\quad First\,RTT\,mesaurement = R\\ 
given\quad Clock\,Granularity = G\\  
SRTT \Leftarrow R  \\
RTTVAR \Leftarrow \frac{R}{2} \\\\
RTO = SRTT + max(G, K * RTTVAR)
\end{matrix}
$$

해당 수식에 대해서 좀 더 알고 싶다면, [Colby College - Computer Science, Transport Layer](https://cs.colby.edu/courses/F19/cs331/notes/6.TransportLayer(4).pdf) 해당 내용을 참고하도록 하자.

위와 같은 값들을 토대로 TCP는 재전송을 하게 되는데 초기 재전송 이후에는 TCP는 지수적 백오프(Exponentional BackOff)[^18] 를 통해서 재전송을 하게 된다.
지수적 백오프는  $RTO = q * RTO$ 와 같은 식이라 보면되고, q는 여기서 주로 2로 설정해서 사용한다. 

따라서, RTO 값이 200ms였으면 200 -> 400 -> 800 -> 1600으로 점진적으로 증가한다. 그렇다면 재전송 횟수는 제한 없이 무한정 커지게 될까? 이는 커널파라미터를 통해서 확인할 수 있다.

#### STEP 3.4.1 TCP 재전송 커널파라미터 

```sh
sudo sysctl -a | grep -i retries
net.ipv4.tcp_orphan_retries = 0
net.ipv4.tcp_retries1 = 3
net.ipv4.tcp_retries2 = 15
net.ipv4.tcp_syn_retries = 6
net.ipv4.tcp_synack_retries = 5
```

위 내용들이 바로 재전송 작업과 관련된 커널 파라미터이다.

1. `net.ipv4.tcp_orphan_retries` : `FIN_WAIT1` 상태의 소켓인 경우에 `FIN` 패킷에 대한 최대 재전송 횟수 정의 
2. `net.ipv4.tcp_retries1` : IP 레이어에 네트워크가 잘못 되었는지 확인토록 사인을 보내는 기준 (soft threshold)
3. `net.ipv4.tcp_retries2` : 더 이상 통신을 할 수 없다 판단하는 기준 (hard threshold)
4. `net.ipv4.tcp_syn_retries` : 초기 연결 수립 시 `SYN` 패킷에 대한 최대 재전송 횟수 정의 
5. `net.ipv4.tcp_synack_retries` : 상대편이 보낸 `SYN` 패킷에 대해 응답을 보내는 `SYN + ACK` 의 최대 재전송 횟수 정의

여기서, `net.ipv4.tcp_orphan_retries` 는 따로 볼 필요가 있다.

```c
//https://github.com/torvalds/linux/blob/master/include/net/tcp.h#L141
#define TCP_RTO_MAX	((unsigned)(120*HZ))
#define TCP_RTO_MIN	((unsigned)(HZ/5))

//https://github.com/torvalds/linux/blob/master/net/ipv4/tcp_timer.c#L233
static int tcp_write_timeout(struct sock *sk) {
	if (sock_flag(sk, SOCK_DEAD)) {
		...
		const bool alive = icsk->icsk_rto < TCP_RTO_MAX;
		retry_until = tcp_orphan_retries(sk, alive);
		...
	}
}


//https://github.com/torvalds/linux/blob/master/net/ipv4/tcp_timer.c#L146
static int tcp_orphan_retries(struct sock *sk, bool alive)
{
	int retries = READ_ONCE(sock_net(sk)->ipv4.sysctl_tcp_orphan_retries); /* May be zero. */

	/* We know from an ICMP that something is wrong. */
	if (READ_ONCE(sk->sk_err_soft) && !alive)
		retries = 0;

	/* However, if socket sent something recently, select some safe
	 * number of retries. 8 corresponds to >100 seconds with minimal
	 * RTO of 200msec. */
	if (retries == 0 && alive)
		retries = 8;
	return retries;
}
```

`tcp_orphan_retries()` 함수가 실제 `FIN_WAIT1` 재처리 시 호출되는 함수 이다. 이 중에서 `retries == 0 && alive` 조건이 중요한데, `alive` 는 최근에 데이터 전송 유무인데 이 값이 1이라면 0으로 설정되어있더라도 8번 재시도를 하게된다. 
`tcp_write_timout()` 함수를 보면, `alive` 값을 구하는 부분이 나오는데 `TCP_RTO_MAX` 보다 작을 경우 `true` 로 선언되는 것으로 볼 수 있다.

참고로 `TCP_RTO_MAX` 는 120초이고, `TCP_RTO_MIN`은 1초(1000ms) / 5이므로 200ms이다. 

이러한 값들을 토대로 어플리케이션의 타임아웃을 설정해야된다. 

만약, 초기 연결 수립 과정 시에 어플리케이션 타임아웃을 1초 이내로 해두면 `InitRTO` 보다 작은 값이 될 것이고, 패킷 유실이 발생하면 타임아웃 문제가 발생할 것이다.
연결 수립 이후에도 `TCP_RTO_MIN` 보다 타임아웃을 낮게 설정해두면 이 또한, 재전송 매커니즘을 제대로 활용할 수 없을 것이다.

따라서, 모니터링 도구 등을 확인하여 평균적인 요청/응답 속도와 해당 커널 파라미터들의 값을 고려해서 설정을 해야 TCP 재전송 매커니즘을 제대로 활용할 수 있을 것이다. 

## STEP 4.  결론

원래는 포스팅을 2개로 나눠서 작성을 하고자 했으나 귀차니즘에 의해서 계속 작성하다보니 매우 장문의 포스팅이 되버렸다.
이 점 너른 양해 부탁드린다.

이 포스팅에서 다룬 내용은 아래와 같다.

1. 소켓이 무엇인지와 소켓의 종류
2. 커널 코드 분석을 통한 실제 소켓 생성 매커니즘
3. 커널 코드 분석을 통한 TCP 소켓의 연결 수립/해제 과정
4. 커널 코드 분석을 통한 TCP 소켓의 메시지 송/수신 과정
5. TCP를 사용하면서 겪을 수 있는 다양한 문제들과 TCP 관련 커널 파라미터들

이러한 기저지식을 통해서 실제 서비스에서 겪고 있는 문제점이나 TCP와 소켓에 대한 호기심이 해결되었길 바란다.

## 레퍼런스

1. https://www.beej.us/guide/bgnet/
2. https://linux-kernel-labs.github.io/refs/heads/master/labs/networking.html
3. http://www.haifux.org/lectures/217/netLec5.pdf
4. https://cs3157.github.io/www/2022-9/lecture-notes/13-tcp-ip.pdf
5. https://www.cs.unh.edu/cnrg/people/gherrin/linux-net.html#tth_chAp2
6. https://os.korea.ac.kr/wp-content/uploads/2020/11/10_TCP-in-Linux.pdf
7. https://d2.naver.com/helloworld/47667
8. https://tech.kakao.com/2016/04/21/closewait-timewait/
9. https://jungseob86.tistory.com/12

[^1]: https://en.wikipedia.org/wiki/Everything_is_a_file
[^2]: https://en.wikipedia.org/wiki/Network_socket#Types
[^3]: https://github.com/torvalds/linux/blob/master/include/linux/net.h#L64
[^4]: https://github.com/torvalds/linux/blob/master/include/linux/net.h#L117
[^5]: https://github.com/torvalds/linux/blob/master/include/linux/tcp.h#L177
[^6]: https://github.com/torvalds/linux/blob/master/net/ipv4/tcp.c#L412
[^7]: https://github.com/torvalds/linux/blob/master/net/socket.c#L2144
[^8]: https://github.com/torvalds/linux/blob/master/net/socket.c#L748
[^9]: https://github.com/torvalds/linux/blob/master/net/ipv4/af_inet.c#L833
[^10]: https://github.com/torvalds/linux/blob/master/net/ipv4/tcp.c#L1331
[^11]: https://github.com/torvalds/linux/blob/master/net/ipv4/tcp_output.c#L2658
[^12]: https://github.com/torvalds/linux/blob/master/net/ipv4/tcp_output.c#L1244
[^13]: https://github.com/torvalds/linux/blob/master/net/ipv4/tcp.c#L2551
[^14]: https://brunch.co.kr/@alden/15
[^15]: https://en.wikipedia.org/wiki/HTTP_persistent_connection#HTTP_1.1
[^16]: https://elixir.bootlin.com/linux/latest/source/include/net/sock.h#L1271
[^17]: https://docs.bluecatnetworks.com/r/DNS-Edge-Deployment-Guide/How-DSR-load-balancing-works
[^18]: https://en.wikipedia.org/wiki/Exponential_backoff