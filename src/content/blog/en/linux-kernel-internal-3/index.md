---
title: "[Kernel] A Deep Dive into Sockets and TCP with the Linux Kernel"
date: 2023-10-12 17:45:00 +0900
tags:
  - Linux
  - Core
emoji: 💻
author: 개발한입
categories: 개발 인프라 독서요약
---

> 🤖 **Note**: This post was machine-translated from the [Korean original](/linux-kernel-internal-3/). It may contain awkward phrasing or minor translation errors. If anything is unclear, please refer to the original or leave a comment below.

```toc
```

# Overview

This post covers sockets, which underlie the kernel, and TCP, which handles them.

I originally planned to cover NUMA, but I'm counting on another member of my study group to write that up, so I will focus on sockets and TCP.

Briefly, this post covers:

**What a socket is, how TCP actually establishes/tears down connections, and how it sends/receives messages.**

**And the service-level problems TCP can cause.**

## STEP 1. What Is a Socket?

While developing, you have surely heard the word socket countless times.

Networking is built on sockets for communication — so what exactly is a socket?

> A way to speak to other programs using standard Unix file descriptors
> + Beej's Guide to Network Programming Using Internet Sockets

In other words, it is **a way of exchanging information with other programs through standard Unix file descriptors.**

Why do file descriptors suddenly appear here? To understand this, you need the UNIX concept of **"Everything is a file"**[^1].

Simply put, it is the idea that **input/output on all kinds of resources is handled as a byte stream, just like a simple file** — and since sockets fall under this concept, the definition above makes sense.

If you think about it, when we send data over the network we go through byte serialization and deserialization — you could say this too stems from the **"Everything is a file"**[^1] concept.

So how do we obtain a file descriptor? Through one of the system calls: `socket()`.

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

The functions above are the internal implementation of the actual system call. The actual call flow is:

1. User space calls the `socket()` function
2. The kernel, via the system call interface, calls `SYSCALL_DEFINE3` $\Rightarrow$ `__sys_socket()`
3. `__sys_socket()` internally calls `__sys_socket_create()` to create the socket
4. `__sys_socket()` maps the created socket to a file descriptor and returns the file descriptor to user space
5. User space performs various I/O operations through the returned file descriptor

After obtaining the FD this way, information can be exchanged through functions like `send(), recv()`.

In diagram form:

<p align="center">
    <img src="https://i.imgur.com/ERkokdv.png">
</p>
<p align="center">
    <em>Figure 1. Socket creation process</em>
</p>

At this point, readers may wonder:

> If it's just a file anyway, can't we use system calls like `read(), write()` instead?

Of course that works too. But sockets have their own communication conventions, and for controlling the information exchanged, functions like `send(), recv()` are recommended.

### STEP 1.1 Types of Sockets

There are many kinds of sockets: Internet sockets, Unix sockets, X.25 sockets, and more[^3].

Unix sockets may be covered in a future post; here I will only deal with Internet sockets.

Internet sockets also come in several types[^2], mainly three:

1. Stream sockets (`SOCK_STREAM`)
2. Datagram sockets (`SOCK_DGRAM`)
3. Raw sockets (`SOCK_ROW`)

In this post we will look at **stream sockets and datagram sockets.**

#### STEP 1.1.1 Stream Sockets

A stream socket connects both ends reliably. When you send data through this socket, ordering is guaranteed, and there is even error detection and correction.

> Reliable, order-preserving, with error detection — haven't we seen this concept somewhere?

Yes, it's exactly what you're thinking of.

Stream sockets **use TCP**, which is why they have these capabilities.

#### STEP 1.1.2 Datagram Sockets

Datagram sockets, on the other hand, are less reliable and connectionless.

> Unreliable and connectionless — haven't we seen this somewhere too?

You probably all know: **datagram sockets are the sockets used by UDP.**

## STEP 2. TCP and Sockets Through Kernel Code

Above we briefly covered the definition and types of sockets. In this post we will focus our analysis on **stream sockets**, i.e., TCP.

In Figure 1 we saw briefly how a socket is created on a socket system call and how a file descriptor is returned.

So what does the structure of a stream socket look like?

<p align="center">
    <img src="https://i.imgur.com/tuwGhkk.png">
</p>
<p align="center">
    <em><a href="https://os.korea.ac.kr/wp-content/uploads/2020/11/10_TCP-in-Linux.pdf">Figure 2. Socket structures managed in the kernel, TCP in Linux, Korea Univ, 2020, p.9</a></em>
</p>

Sockets involve various structures, and the most abstract among them is `struct socket`[^4].

Depending on the socket type, this structure (`struct socket`[^4]) ends up wrapped in a different outer shell.

So when is the stream socket `struct tcp_sock`[^5] initialized? The overall flow is as in the figure above, but a stream socket is initialized when the `tcp_init_sock()`[^6] function is called.

The data in the structure created after calling `tcp_init_sock()`[^6] looks like this:

<p align="center">
    <img src="https://i.imgur.com/wZcWe16.png">
</p>
<p align="center">
    <em><a href="https://os.korea.ac.kr/wp-content/uploads/2020/11/10_TCP-in-Linux.pdf">Figure 3. Socket state right after initial creation, TCP in Linux, Korea Univ, 2020, p.11</a></em>
</p>

Here, let's just note the state and the type. The important `write, receive, backlog queue` will be covered while explaining the communication process.

Since it's right after initialization, the state is naturally `SS_UNCONNECTED` (not connected), and since it is a TCP socket, we can see it was created with type `SOCK_STREAM`.

### STEP 2.1 The TCP Handshake Through Kernel Code

Above we briefly looked at socket creation, stream socket initialization, and its structure.

Now let's look at TCP connection establishment and teardown — the 3-way handshake and the 4-way handshake — at the kernel level.

Naturally, this first requires an understanding of the network layers.

<p align="center">
    <img src="https://i.imgur.com/cqp4KBo.png">
</p>
<p align="center">
    <em>Figure 4. Network layers</em>
</p>

The important point here is that we must look at this from the server's perspective, not the client's.

**From the client's perspective, a packet is naturally sent to the server through the Application Layer $\Rightarrow$ Network Interface Layer.**

**From the server's perspective, a request is processed through the Network Interface Layer $\Rightarrow$ Application Layer.**

In diagram form:

<p align="center">
    <img src="https://i.imgur.com/SYUaRAp.png">
</p>
<p align="center">
    <em>Figure 5. Request/response flow through the network layers</em>
</p>

Rather than the client's request path, we want to look at what happens while the server responds.

When a client request arrives, where does TCP's 3-way handshake begin?

It happens exactly **at the point where information is passed from the Internet Layer $\Rightarrow$ Transport Layer.**

#### STEP 2.1.1 3-Way Handshake

Looking at the kernel code for **the moment data is handed from the Internet Layer $\Rightarrow$ Transport Layer**, we can trace the handshake process.

The code fragment below excerpts some of the functions and logic involved.

```c
// https://github.com/torvalds/linux/blob/master/net/ipv4/ip_input.c#L560
/*
 * IP receive entry point
 */
int ip_rcv(struct sk_buff *skb, struct net_device *dev, struct packet_type *pt,
	   struct net_device *orig_dev) 
{
	... (omitted) ...
}

//https://github.com/torvalds/linux/blob/master/net/ipv4/ip_input.c#L242
/*
 * 	Deliver IP Packets to the higher protocol layers.
 */
int ip_local_deliver(struct sk_buff *skb)
{
	... (omitted) ...
}

//https://github.com/torvalds/linux/blob/master/net/ipv4/tcp_ipv4.c#L1982
int tcp_v4_rcv(struct sk_buff *skb)
{
	... (omitted) ...
}

//https://github.com/torvalds/linux/blob/master/net/ipv4/tcp_ipv4.c#L1707
int tcp_v4_do_rcv(struct sock *sk, struct sk_buff *skb)
{
	... (omitted) ...
	if (tcp_rcv_state_process(sk, skb)) {
		rsk = sk;
		goto reset;
	}
	return 0;
	
reset:
	tcp_v4_send_reset(rsk, skb);
	... (omitted) ...
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
	... (omitted) ...
	switch (sk->sk_state) {
	case TCP_CLOSE:
		... (omitted) ...

	case TCP_LISTEN:
		if (th->ack)
			return 1;

		if (th->rst) {
			... (omitted) ...
		}
		if (th->syn) {
			... (omitted) ...
		}
		SKB_DR_SET(reason, TCP_FLAGS);
		goto discard;

	case TCP_SYN_SENT:
		... (omitted) ...
		return 0;
	}
	... (omitted) ...
	switch (sk->sk_state) {
	case TCP_SYN_RECV:
		... (omitted) ...
	case TCP_FIN_WAIT1:
		... (omitted) ...
	case TCP_CLOSING:
		... (omitted) ...
	case TCP_LAST_ACK:
		... (omitted) ...
	... (omitted) ...
}
```

You can follow the actual code through the links in the comments.
To keep the flow clear, all non-essential code was omitted. If you want to understand this process in full, read through the code carefully.

The flow is as follows:
1. When a frame is delivered to the IP layer, `ip_rcv()` is called
2. After internal processing, it is passed to the TCP layer via `ip_local_deliver()`
3. `tcp_v4_rcv()` is called, does its internal work, then calls `tcp_v4_do_rcv()`
4. `tcp_v4_do_rcv()` branches:
	1. If the state is `TCP_ESTABLISHED` (connection already established), it calls `tcp_rcv_established()`
	2. Otherwise, it calls `tcp_rcv_state_process()` for the connection establishment process
5. The internal logic of `tcp_rcv_state_process()` performs the actual **3-way handshake**

#### STEP 2.1.2 4-Way Handshake

Above we examined the 3-way handshake at the kernel level.

It may seem more complex than expected, but readers who have studied some CS fundamentals should have followed it easily.

Compared to the 3-way, the 4-way handshake is much simpler.

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
	... (omitted) ...
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
	... (omitted) ...
}
```

The function above, `tcp_fin()`, is the logic behind the **4-way handshake** that occurs during connection termination as we know it.

This function is called when a `FIN` bit arrives.

### STEP 2.2 TCP Message Send/Receive Through Kernel Code

<p align="center">
    <img src="https://i.imgur.com/SYUaRAp.png">
</p>
<p align="center">
    <em>Figure 5. Request/response flow through the network layers</em>
</p>

I brought back the figure we saw earlier, because it is directly related to TCP send/receive.

Suppose we wrote an application, and that application communicates over HTTP.

Then **to send a message elsewhere, it goes through the Application $\Rightarrow$ Network Interface layers, as on the left side.**

Conversely, **on the receiving side, for information to reach the application it goes through the Network Interface $\Rightarrow$ Application layers.**

In short:

1. **Sending a message: the process going Application Layer $\Rightarrow$ Network Interface Layer**
2. **Receiving a message: the process going Network Interface Layer $\Rightarrow$ Application Layer**

Keeping this in mind will make the following easier to understand.

#### STEP 2.2.1 The TCP Send Path

<p align="center">
    <img src="https://i.imgur.com/Ubiupzw.png">
</p>
<p align="center">
    <em><a href="https://www.cs.unh.edu/cnrg/people/gherrin/linux-net.html">Figure 6. TCP message send overview, Message Traffic Overview, New Hampshire Univ, 2000</a></em>
</p>

As explained above, you can see the operations going **Application Layer $\Rightarrow$ Network Interface (= Link) Layer.**
The overall flow is:

1. A socket write system call occurs (`__sys_sendto()`[^7])
	1. The socket sets up the message transmission process (`sock_sendmsg()`[^8])
	2. The message header is sent to the applicable transport-layer protocol (TCP/UDP) (`inet_sendmeg()`[^9])
2. The TCP layer carries out the transmission
	1. The payload is copied from user space into kernel space (`tcp_sendmsg()`[^10])
	2. Work is done for congestion control (`tcp_write_xmit()`[^11])
	3. The TCP header is attached and transmitted (`tcp_transmit_skb()`[^12])
3. The lower layers handle the transmission

Here I want to look at just one important function.

First, `tcp_sendmsg()`[^10]. This function copies data from user space into a kernel-space buffer and adds it to the `write queue` of `struct tcp_sock`.

<p align="center">
    <img src="https://i.imgur.com/b4O9xVe.png">
</p>
<p align="center">
    <em><a href="https://os.korea.ac.kr/wp-content/uploads/2020/11/10_TCP-in-Linux.pdf">Figure 7. Internal flow of tcp_sendmsg(), TCP in Linux, Korea Univ, 2020, p.19</a></em>
</p>

#### STEP 2.2.2 The TCP Receive Path

<p align="center">
    <img src="https://i.imgur.com/NdGpFCI.png">
</p>
<p align="center">
    <em><a href="https://www.cs.unh.edu/cnrg/people/gherrin/linux-net.html">Figure 8. TCP message receive overview, Message Traffic Overview, New Hampshire Univ, 2000</a></em>
</p>

As explained above, you can see the operations going **Network Interface (= Link) Layer $\Rightarrow$ Application Layer.**

Actually, the message receive path was mostly covered while going through the 3-way handshake.

Refer to the 3-way handshake section above for the full flow; here I will only point out the details worth noting.

The TCP receive side mainly uses two queues:

1. **Receive Queue: a queue for data received from the network but not yet read by the application**
	+ Data is retrieved from this queue via system calls like `recv()`; when the queue is full, the sender is signaled to throttle its transmission rate.
2. **Backlog Queue (Accept Queue): a queue for handling connection requests received by the server but not yet accepted by the application**
	+ When preparing a new connection via something like `accept()`, the kernel retrieves the oldest connection request from this queue and creates a new socket.

Previously there was also a concept called the PreQueue (Pre-Demux Queue), but it was removed after version 4.14.
+ [tcp: remove prequeue support : Github](https://github.com/torvalds/linux/commit/e7942d0633c47c791ece6afa038be9cf977226de)

With these two queues in mind, let's understand the `tcp_v4_rcv()` function.

```c
int tcp_v4_rcv(struct sk_buff *skb) // sk_buff means socket buffer.
{
	...
	const struct iphdr *iph; // IP layer header
	const struct tcphdr *th; // TCP header
	...
	th = (const struct tcphdr *)skb->data; // Locate the start of the header via the payload held in sk_buff
	iph = ip_hdr(skb); // Identify the IP header via sk_buff
	...
	process : // The part responsible for TCP processing
	...
		if (!sock_owned_by_user(sk)) { // If user space is not currently using this socket
			ret = tcp_v4_do_rcv(sk, skb); // Perform the actual connection establishment process.
		} else { // If user space is using this socket
			if (tcp_add_backlog(sk, skb, &drop_reason)) // Put it into the backlog queue
				goto discard_and_relse; 
		}
	...
}
```

You should have a rough understanding now.

The backlog queue should make sense at this point — then when is the receive queue used?

To find out, let's first look at `tcp_v4_do_rcv()`.

```c
int tcp_v4_do_rcv(struct sock *sk, struct sk_buff *skb)
{
	if (sk->sk_state == TCP_ESTABLISHED) { /* Fast path (connection already established) */
		... 
		tcp_rcv_established(sk, skb);
		return 0;
	}	
	...
	/* Slow path (not yet established): perform the tasks below, then do the handshake */
	if (tcp_checksum_complete(skb))  // Perform checksum verification
		goto csum_err;
	...
	if (sk->sk_state == TCP_LISTEN) {
		struct sock *nsk = tcp_v4_cookie_check(sk, skb);  // Perform SYN cookie check
		
		if (!nsk) 
			goto discard; 

		if (nsk != sk) // If the socket after the SYN cookie check differs from the parameter socket (SYN flood defense mechanism)
		{ 
			if (tcp_child_process(sk, nsk, skb)) // Handle the child socket
			{
				 rsk = nsk; goto reset; 
			} 
			return 0; 
		}
	}
	...
	// After passing the exception-handling mechanisms above, do the actual handshake work
	if (tcp_rcv_state_process(sk, skb)) 
	{ 
		rsk = sk; 
		goto reset; 
	}
}
```

TCP receive processing branches as follows:
1. The existing socket is in `TCP_ESTABLISHED` state: **likely to be handled via the Fast Path.**
2. The existing socket is not in `TCP_ESTABLISHED` state: **likely to be handled via the Slow Path.**

Naturally, if it is not `TCP_ESTABLISHED`, the handshake takes place. Either way, both eventually call a function named `tcp_rcv_established()` — and even there, the two paths differ.

```c
// https://github.com/torvalds/linux/blob/master/net/ipv4/tcp_input.c#L5868
void tcp_rcv_established(struct sock *sk, struct sk_buff *skb)
{
	...
	if (tcp_header_len == sizeof(struct tcphdr) + TCPOLEN_TSTAMP_ALIGNED) { // Falling into the cases below means Slow Path.
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
			goto step5; // This is also handled via the Slow Path.
		...
	
		eaten = tcp_queue_rcv(sk, skb, &fragstolen); // Actually put the data into the receive queue. (Fast Path)
			
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
			tcp_data_ready(sk); // Signal that data has been added to the receive queue
			return;
		}
	}
slow_path:
	...
step5:
	reason = tcp_ack(sk, skb, FLAG_SLOWPATH | FLAG_UPDATE_TS_RECENT);
	...
	/* step 7: process the segment text */
	tcp_data_queue(sk, skb); // Handle TCP segment options and flags, insert out-of-order arrivals into the correct position, etc.

	tcp_data_snd_check(sk);
	tcp_ack_snd_check(sk);
	return;
}
```

To understand the above, you need to know about the **Fast Path and Slow Path**:

1. **Fast Path: an optimized mechanism handling the most common, expected work; since it only handles the most common cases, it is less complex than the Slow Path.**
	+ Example: packets arrive in order and everything is as expected
2. **Slow Path: performs various tasks such as packet inspection and flow control, so it is slower than the Fast Path and relatively more complex.**
	+ Example: packets arrive out of order, or specific flags are set that require extra processing

As shown above, data is ultimately placed in the receive queue, and when user space calls a system call like `recv()`, a function like `tpc_recvmsg()`[^13] takes the data from the receive queue and processes it.
That is, everything above is the path up to connection establishment; once data sits in the receive queue, system calls take the data from the receive queue and handle reception.

Summarized as a diagram, the flow looks like this:

<p align="center">
    <img src="https://i.imgur.com/kqwfDdp.png">
</p>
<p align="center">
    <em>Figure 9. TCP message receive path via Fast Path / Slow Path</em>
</p>

## STEP 3. Problems Services Can Face When Using TCP

The hard part is now behind us. What follows is much easier reading, and much of it may already be familiar.

The focus will be on `TIME_WAIT` and `CLOSE_WAIT` sockets, HTTP persistent connections and TCP keep-alive, and timeouts.

### STEP 3.1 TIME_WAIT Sockets

<p align="center">
    <img src="https://i.imgur.com/gfqildB.png">
</p>
<p align="center">
    <em>Figure 10. TCP message receive path via Fast Path / Slow Path</em>
</p>

Before we get into `TIME_WAIT`, look at the related 4-way handshake diagram first.

Here, instead of server-client, the terms Active Closer and Passive Closer are used. They mean:

+ **Active Closer: the side that closes the connection first**
+ **Passive Closer: the other side**

Looking closely, the `TIME_WAIT` socket is created on the Active Closer side. That is, `TIME_WAIT` can appear on the client, and it can appear on the server as well.

Before understanding `TIME_WAIT`, let's confirm that the handshake process we saw actually happens. I installed Nginx in a virtual machine and analyzed it with Wireshark via tcpdump.

![](https://i.imgur.com/G1jWW7G.png)

1. The client (192.168.106.1) sends a `SYN` packet to port 80 of the server (192.168.106.3).
2. The server sends the client a `SYN+ACK` packet.
3. The client sends the server an `ACK` packet.

That is the **3-way handshake.**

---

4. After the 3-way handshake, the client sends a GET request.
5. The server (Active Closer) sends the client (Passive Closer) a `FIN` packet to close the connection.
6. The client responds with an `ACK` packet.
7. After cleaning up its socket, the client sends the server a `FIN` packet to terminate the connection.
8. The server sends the client an `ACK` packet and closes the connection.

That is the **4-way handshake.**

We have now actually confirmed the handshake process we saw earlier. So how can the `TIME_WAIT` state affect a service?

First, **socket port exhaustion can occur.**

```sh
sysctl net.ipv4.ip_local_port_range
# net.ipv4.ip_local_port_range = 32768	60999 # MIN MAX
```

This kernel parameter controls the number of ports available to sockets.

On my virtual machine, ports 32768 through 60999 are in use for this.

If all local ports are in the `TIME_WAIT` state, there are no ports left to allocate, so communication with the outside becomes impossible and **the application can hit timeout problems.**

Also, if `TIME_WAIT` occurs frequently, we can infer that **TCP itself is establishing/tearing down connections frequently.**

That means lots of handshakes, which **can degrade the overall response time of the service.**
To prevent this, modern applications use connection pools to reuse TCP connections once established.

#### STEP 3.1.1 The Client Side

Above I briefly described the problems when `TIME_WAIT` sockets pile up. Now let's look at the server and client sides separately.
Don't get confused: `TIME_WAIT` occurs on the Active Closer side, so it can occur on both the server and the client.

<p align="center">
    <img src="https://i.imgur.com/q2rPjqj.png">
</p>
<p align="center">
    <em>Figure 11. A simple 2-tier system</em>
</p>

In the figure, in the segment where the user issues a POST to the web server, the user is the client and the web server is the server.

However, in the segment communicating with the DB server, the web server is the client and the DB server plays the server role.

If the web server closes the connection to the DB server first, the web server becomes the Active Closer, and `TIME_WAIT` sockets can occur.

A socket has four essential values. To see them, let's briefly pull up the `struct sock_common` structure.

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

+ `sck_addrpair` holds the source and destination IPv4 addresses.
+ `sck_portpair` holds the port numbers.
+ `skc_hash` is a hash value for fast socket lookup; it helps determine which socket a packet belongs to when it arrives.

That is, the pair of `sck_addrpair` and `sck_portpair` is hashed, and this socket is **unique within the kernel**, and — as we saw at the beginning — an FD (File Descriptor) is handed out for it.

When such a socket is actively closed, it remains in the `TIME_WAIT` state. **Therefore, until the `TIME_WAIT` state on that socket clears, the socket cannot be used again.**

As `TIME_WAIT` sockets keep piling up this way and all local ports are exhausted — using up the entire `net.ipv4.ip_local_port_range` — communication becomes impossible.

Let's test this.

```sh
curl https://www.google.co.kr > /dev/null 2>&1 
netstat -napo | grep TIME_WAIT 
tcp        0      0 192.168.106.3:51292     142.250.207.99:443      TIME_WAIT   -                    timewait (8.68/0/0)
```

The command above sends a request to `www.google.co.kr` via `curl`, after which `TIME_WAIT` occurs — because `curl` itself has a mechanism that closes the connection once it receives the response after a request.
See the detailed code [here](https://github.com/curl/curl/blob/master/lib/url.c#L3895).

Anyway, we can now easily create a `TIME_WAIT`. Our hypothesis was that **the same socket cannot be reused, so let's verify that hypothesis.**

```sh
sysctl net.ipv4.ip_local_port_range
# net.ipv4.ip_local_port_range = 32768	60999

sudo sysctl -w "net.ipv4.ip_local_port_range=32768 32768" # Shrink the Internet socket port range to a single port, 32768
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

+ Restrict the port range with `sudo sysctl -w "net.ipv4.ip_local_port_range=32768 32768"`.
+ On the same request, you can see the error `curl: (7) Couldn't connect to server`.

Our hypothesis is thus verified.

So what can we do about this port exhaustion? We can use the `net.ipv4.tcp_tw_reuse` parameter.

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

With `net.ipv4.tcp_tw_reuse` enabled, requests keep working. Below is how this parameter operates.

<p align="center">
    <img src="https://i.imgur.com/90rafkG.png">
</p>
<p align="center">
    <em><a href="https://www.yes24.com/Product/Goods/44376723">Figure 12. How the net.ipv4.tcp_tw_reuse parameter works, "Linux Kernel Stories for DevOps and SE" by Jinwoo Kang (Korean), 2017</a></em>
</p>

However, this approach is only a stopgap, not a fundamental solution. So how can we solve the problem properly? By using a **Connection Pool.**

> ❗❗ Important
>
> Calling it a stopgap does not mean it is fine to turn the parameter (`net.ipv4.tcp_tw_reuse`) off.
>
> The virtual environment I set up for this post is Ubuntu 22.04, running kernel 5.15.0-84.
>
> In this kernel version, the **parameter is enabled by default.**
>
> So "stopgap" means: when many `TIME_WAIT` sockets occur, socket reuse alone has limits — **check whether the client application uses a connection pool, and if it does not, apply that method.**

<p align="center">
    <img src="https://i.imgur.com/NaZDtxa.png">
</p>
<p align="center">
    <em><a href="https://www.yes24.com/Product/Goods/44376723">Figure 13. Connection-less vs Connection Pool, "Linux Kernel Stories for DevOps and SE" by Jinwoo Kang (Korean), 2017</a></em>
</p>

The connection-less approach is what we examined above; a connection pool keeps sockets open in advance, avoiding unnecessary TCP establishment/teardown and thereby improving response times.

Curious whether `TIME_WAIT` actually decreases when using a connection pool? Let's verify that hypothesis too. I installed Docker on the VM, ran Redis, and wrote scripts that issue the `setex` command.

+ Connection-less approach

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

+ Connection Pool approach

```sh
#!/usr/bin/python
import redis
import time

count = 0
pool = redis.ConnectionPool(host='localhost', port=6379, db=0) # Create a connection pool using the Redis client.
while True:
    if count > 10000:
        break;
    r = redis.Redis(connection_pool=pool) # Use the connection pool for the actual connection.
    print("SET")
    r.setex(count,10,count)
```

+ Results

```sh
# With the connection-less approach
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

# With the Connection Pool approach
netstat -napo | grep -i 6379
(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
tcp        0      0 0.0.0.0:6379            0.0.0.0:*               LISTEN      -                    off (0.00/0/0)
tcp        5      0 172.17.0.1:45724        172.17.0.2:6379         ESTABLISHED -                    keepalive (5.72/0/0)
tcp        0      0 127.0.0.1:6379          127.0.0.1:43862         ESTABLISHED -                    keepalive (5.71/0/0)
tcp        5      0 127.0.0.1:43862         127.0.0.1:6379          ESTABLISHED 3525/python3         off (0.00/0/0)
tcp6       0      0 :::6379                 :::*                    LISTEN      -                    off (0.00/0/0)
```

You can see a big difference. However, the connection pool approach also has drawbacks, which are related to TCP keep-alive — we will look at them later.

#### STEP 3.1.2 The Server Side

Now let's consider the situation where the Active Closer is the server. Unlike the client, the server keeps sockets open and receives requests, so there is no local port exhaustion problem.
However, if `TIME_WAIT` sockets occur frequently, unnecessary handshakes can become frequent, just like the client-side problem.

So in what cases can `TIME_WAIT` occur on the server? I had installed Nginx above; here I will set the `keepalive_timeout` value to 0.

```json
server {
        keepalive_timeout 0; // Added
        listen 80 default_server;
        listen [::]:80 default_server;
        ...
}
```

Then send requests from the client to that Nginx.

```sh
curl -s http://192.168.106.3 > /dev/null # Run several times. (Must be the client terminal)


netstat -napo | grep -i :80 # On the server terminal you can see TIME_WAIT as below.
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

Requests were sent from the host machine (client, `192.168.106.1`) to the virtual machine (server, `192.168.106.3`); since keep-alive is off, the server closes the connection after responding — and we can see those sockets are in the `TIME_WAIT` state.

> 💡 Note
>
> The book mentions enabling the `net.ipv4.tcp_tw_recycle` kernel parameter as one solution, but it was **removed from kernel 4.12 onward.**
>
> I explain the reason for its removal below, but if you are curious about the commit itself, see [here](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=4396e46187ca5070219b81773c4e65088dac50cc).

Previously, this could be solved by enabling the `net.ipv4.tcp_tw_recycle` parameter, but it has a fatal drawback.

The `net.ipv4.tcp_tw_recycle` parameter is a feature that lets the server quickly reclaim and recycle sockets.

When this kernel parameter is enabled, it behaves as follows:
1. Store the timestamp of the last packet received on the socket
2. Change the `TIME_WAIT` socket's timer to a value based on the RTO (Retransmission Timeout)[^14]

Since the RTO is usually in milliseconds, `TIME_WAIT` shrinks — but behavior #1 can cause the following problem:

<p align="center">
    <img src="https://i.imgur.com/IbwwDRm.png">
</p>
<p align="center">
    <em><a href="https://www.yes24.com/Product/Goods/44376723">Figure 14. The problem caused by enabling tcp_tw_recycle, "Linux Kernel Stories for DevOps and SE" by Jinwoo Kang (Korean), 2017</a></em>
</p>

Suppose clients C1 and C2 exist behind the same NAT. Then from server S's perspective, they look like the same client.

1. S performs a 4-way handshake to terminate C1's request
2. When the `TIME_WAIT` socket occurs, it is set with the RTO value and cleaned up quickly, and the timestamp of C1's FIN packet is stored
3. If $C2_{timestamp} < C1_{timestamp}$, **a request with a smaller timestamp arrived from (what looks like) the same client, so the packet is dropped without processing.**
4. C2 never receives an `ACK` from S, so it keeps retransmitting.

That is, with various clients behind NAT, **there is no guarantee that timestamps increase monotonically, so this causes a fatal problem. (This is why the parameter was removed in 4.12.)**

The thing that solves this is the **keep-alive** option.

To verify server-side `TIME_WAIT` I had set Nginx to `keepalive_timeout 0;` — now let's change this value to 30 seconds and run it.

```sh
sudo systemctl reload nginx
netstat -napo | grep -i :80
#(Not all processes could be identified, non-owned process info
# will not be shown, you would have to be root to see it all.)
#tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN      -                    off (0.00/0/0)
#tcp6       0      0 :::80                   :::*                    LISTEN      -                    off (0.00/0/0)
```

The `TIME_WAIT` sockets are cleanly gone. With keep-alive, even after a request completes, the connection is not closed until the timeout expires — it stays connected.
So `TIME_WAIT` sockets will appear after 30 seconds.

> ❗❗ Important
>
> The keep-alive configured in Nginx here, like `keepalive_time 30;`, corresponds to HTTP/1.1 persistent connections[^15].
>
> TCP also has its own keep-alive — do not confuse the two. TCP keep-alive is covered below.

#### STEP 3.1.3 Why TIME_WAIT Sockets Exist

Above we briefly looked at the client side and the server side.

We learned that frequent `TIME_WAIT` means frequent handshakes, which can degrade performance.

So why was such an inconvenient state created in the first place?

Recall the 4-way handshake. Ultimately, for the Passive Closer to close its socket, it must receive the `LAST_ACK`-stage `ACK` from the Active Closer.

If cleanup happened immediately without `TIME_WAIT`, the `ACK` could not be delivered to the Passive Closer, and then the client socket cleanup would not happen.

That is, without `TIME_WAIT`, many sockets stuck in the `LAST_ACK` state could pile up on the Passive Closer side.

Additionally, if the Active Closer's `ACK` is lost due to network problems, the Passive Closer can resend a `FIN` and the connection can still be closed normally.

In conclusion, it is **an important socket state that gives connection termination a grace period, solving the problems that would occur if connections were torn down immediately.**

### STEP 3.3 TCP Keep-Alive

Now let's cover TCP keep-alive.

Similar to the Nginx keep-alive we saw above, TCP keep-alive is a technique for keeping a session alive between two TCP sockets to reduce overly frequent 3-way handshakes.

TCP keep-alive maintains the session by periodically sending small packets between sessions established after the 3-way handshake.

To see whether the Internet sockets currently in use on our OS support keep-alive, we can check with `netstat`.

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

In my virtual environment, the sockets used for SSH operate with keep-alive. The number after "keepalive" is the time remaining on the timer.

As explained above, when this timer runs out, a small packet is sent to check whether the peer is alive.

So how do we create a keep-alive socket? From user space, when calling the `setsockopt()`[^16] system call, you can create a keep-alive socket via the `optname` argument.

Passing the value corresponding to `SO_KEEPALIVE` creates a keep-alive socket, and inside kernel space the `SO_KEEPALIVE` flag is set on the `sck_flag` value in `struct sock_common`.

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

Most modern applications provide a separate option for configuring TCP keep-alive; I will use Redis here.

```sh
telnet 127.0.0.1 6379 # Run in a separate terminal (to connect)

netstat -napo | grep -i :6379 | grep -i est
(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
tcp        0      0 127.0.0.1:42396         127.0.0.1:6379          ESTABLISHED 7810/telnet          off (0.00/0/0)
tcp        0      0 127.0.0.1:6379          127.0.0.1:42396         ESTABLISHED -                    off (0.00/0/0)
```

Since Redis 3.2.1, the `tcp-keepalive` option defaults to 300. So consider the output above as the result after setting it to 0.

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

As shown above, with keep-alive configured, the timer is running. Capturing a dump and inspecting it with Wireshark shows the following:

![](https://i.imgur.com/08Pd1ws.png)

As we expected, keep-alive packets are being sent periodically. For this dump I set the `tcp-keepalive` value to 10, and you can see a keep-alive packet and keep-alive ACK packet every 10 seconds.

#### STEP 3.3.1 TCP Keep-Alive Parameters

Above we confirmed what TCP keep-alive is and how it works. So what kernel parameters relate to it?

```sh
sudo sysctl -a | grep -i keepalive
net.ipv4.tcp_keepalive_intvl = 75
net.ipv4.tcp_keepalive_probes = 9
net.ipv4.tcp_keepalive_time = 7200
```

1. `net.ipv4.tcp_keepalive_intvl`: **the interval for sending keep-alive packets.** After `net.ipv4.tcp_keepalive_time` passes, a probe packet is sent; this defines how many seconds later a retransmission packet is sent when there is no response.
2. `net.ipv4.tcp_keepalive_probes`: defines **the maximum number of keep-alive packets to send.** Since packets can be lost for various reasons, a retransmission mechanism is needed; this defines the maximum retransmission count.
3. `net.ipv4.tcp_keepalive_time`: **the keep-alive socket's holding time**; it is kept for at least 7200 seconds. The timer operates based on this value. (As in the Redis example, this value is configurable.)

In diagram form:

<p align="center">
    <img src="https://i.imgur.com/pOF6AWj.png">
</p>
<p align="center">
    <em><a href="https://www.yes24.com/Product/Goods/44376723">Figure 15. How the TCP keep-alive parameters work, "Linux Kernel Stories for DevOps and SE" by Jinwoo Kang (Korean), 2017</a></em>
</p>

#### STEP 3.3.2 Zombie Connections

Above we saw the TCP keep-alive mechanism and its kernel parameters.

This reduces unnecessary handshakes and improves service quality, but the bigger benefit is **preventing zombie connections.**

A zombie connection is **an abnormal connection where one of the two sessions has terminated but the other side stays alive.**

Let's verify this. We will use MySQL with the simple script below.

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

+ The case where mysqld terminates normally

```sh
# Initial state after running the Python code
netstat -napo | grep -i :3306
(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
tcp        0      0 0.0.0.0:3306            0.0.0.0:*               LISTEN      -                    off (0.00/0/0)
tcp        0      0 172.17.0.1:50404        172.17.0.2:3306         ESTABLISHED -                    keepalive (6.64/0/0)
tcp        0      0 127.0.0.1:33354         127.0.0.1:3306          ESTABLISHED 26338/python3        keepalive (7176.40/0/0)
tcp        0      0 127.0.0.1:3306          127.0.0.1:33354         ESTABLISHED -                    keepalive (6.64/0/0)
tcp6       0      0 :::3306                 :::*                    LISTEN      -                    off (0.00/0/0)

# State when the MySQL server is shut down normally
netstat -napo | grep -i :3306
(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
tcp        1      0 127.0.0.1:33354         127.0.0.1:3306          CLOSE_WAIT  26338/python3        keepalive (7042.06/0/0)
tcp        0      0 127.0.0.1:3306          127.0.0.1:33354         FIN_WAIT2   -                    timewait (54.04/0/0)
```

Running MySQL and the script, the initial state is `ESTABLISHED`. Then MySQL was shut down normally via `docker stop mysql`.

After that, the client's state became `CLOSE_WAIT`. That is, the `FIN` packet was received by the client normally.

+ The case where the termination packet is lost due to abnormal behavior

This scenario forcibly DROPs all packets using `iptables`. Start the MySQL server again, run the script, and then run the commands below.

```sh
# Normal connection established
netstat -napo | grep -i :3306
(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
tcp        0      0 0.0.0.0:3306            0.0.0.0:*               LISTEN      -                    off (0.00/0/0)
tcp        0      0 127.0.0.1:36210         127.0.0.1:3306          ESTABLISHED 26760/python3        keepalive (7196.60/0/0)
tcp        0      0 127.0.0.1:3306          127.0.0.1:36210         ESTABLISHED -                    keepalive (11.60/0/0)
tcp        0      0 172.17.0.1:52948        172.17.0.2:3306         ESTABLISHED -                    keepalive (11.61/0/0)
tcp6       0      0 :::3306                 :::*                    LISTEN      -                    off (0.00/0/0)

# Drop all packets going to the client socket, then stop the MySQL server
sudo iptables -A OUTPUT -p tcp -d 127.0.0.1 -j DROP
docker stop mysql

# State afterwards
netstat -napo | grep -i :3306
(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
tcp        0      0 127.0.0.1:36210         127.0.0.1:3306          ESTABLISHED 26760/python3        keepalive (7119.27/0/0)
tcp        0      1 127.0.0.1:3306          127.0.0.1:36210         FIN_WAIT1   -                    probe (0.89/0/4)
```

As you can see, the client is still in the `ESTABLISHED` state. My VM's `net.ipv4.tcp_keepalive_time` is 7200 seconds, so the timer starts counting down from 7200 by default.

As we saw above, will keep-alive packets really be sent every `net.ipv4.tcp_keepalive_intvl`, and will the connection be terminated after the maximum retransmissions specified in `net.ipv4.tcp_keepalive_probes`? Let's take a TCP dump to find out.

To reproduce the situation faster, I changed the kernel parameters as follows:
+ `net.ipv4.tcp_keepalive_intvl`: 10
+ `net.ipv4.tcp_keepalive_probes`: 5
+ `net.ipv4.tcp_keepalive_time`: 10

```sh
# Still ESTABLISHED due to the abnormal termination, but you can see the probe count increasing
netstat -napo | grep -i :3306
(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
tcp        0      1 127.0.0.1:3306          127.0.0.1:49424         FIN_WAIT1   -                    probe (18.34/0/7)
tcp        0      0 127.0.0.1:49424         127.0.0.1:3306          ESTABLISHED 1357/python3         keepalive (9.65/0/4)


# After retransmitting as many packets as the configured probe count, the client socket has been cleaned up (zombie connection cleared)
 netstat -napo | grep -i :3306
(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
tcp        0      1 127.0.0.1:3306          127.0.0.1:49424         FIN_WAIT1   -                    probe (51.70/0/8)
```

It works exactly as we learned.

#### STEP 3.3.3 HTTP Persistent Connections vs TCP Keep-Alive

Earlier, we briefly played with Nginx's `keepalive_timeout` option and generated many `TIME_WAIT` sockets.
At that point I said this is different from TCP keep-alive. In fact, what Nginx uses corresponds to HTTP/1.1 persistent connections[^15].

The differences between the two are:
+ TCP Keep-Alive: **a mechanism to detect whether the connection was broken by a network failure or transient problem — it periodically checks whether the connection is still valid.**
+ HTTP persistent connection: **a mechanism that keeps the TCP connection open after a response for a certain time, handling multiple requests/responses over a single TCP connection.**

HTTP persistent connections can be seen as similar to the Connection Pool we saw above. To understand this, HTTP/1.0 needs some explanation.

In HTTP/1.0, a new TCP socket was created for every request. So a handshake occurred for every request. But as the web handled more complex information and requests/responses multiplied, the overhead grew steeply.

Because of this problem, HTTP/1.1 introduced persistent connections, reusing the socket after connection establishment to reduce the overhead.

So how are things handled when the two values differ?

There are two scenarios:

1. $HTTP_{Keep-Alive} > TCP_{Keep-Alive}$: the HTTP persistent connection timeout is greater than the TCP keep-alive timeout
2. $HTTP_{Keep-Alive} < TCP_{Keep-Alive}$: the HTTP persistent connection timeout is smaller than the TCP keep-alive timeout

These two scenarios are best seen in diagrams.

+ The $HTTP_{Keep-Alive} > TCP_{Keep-Alive}$ case

<p align="center">
    <img src="https://i.imgur.com/I4NkfSr.png">
</p>
<p align="center">
    <em>Figure 15. When HTTP keep-alive is greater than TCP keep-alive</em>
</p>

+ HTTP Keep-Alive Timeout: 60 seconds
+ TCP Keep-Alive Timeout: 30 seconds

Every 30 seconds, TCP keep-alive sends a packet to check liveness, then resets its timer.

At the 60-second mark, the HTTP keep-alive timeout fires, and the server closes the connection to the client first.

+ The $HTTP_{Keep-Alive} < TCP_{Keep-Alive}$ case

<p align="center">
    <img src="https://i.imgur.com/iQWwnVa.png">
</p>
<p align="center">
    <em>Figure 16. When HTTP keep-alive is smaller than TCP keep-alive</em>
</p>

+ HTTP Keep-Alive Timeout: 30 seconds
+ TCP Keep-Alive Timeout: 60 seconds

At the 30-second mark, the HTTP keep-alive timeout fires, and the server closes the connection to the client first. Even though the TCP keep-alive timeout is 60 seconds, it gets cleaned up together upon receiving the close request.

In conclusion, **if an HTTP persistent connection is configured, things operate according to that setting** — so there is no need to worry when the two values differ.

#### STEP 3.3.4 Load Balancers and TCP Keep-Alive

The author, Jinwoo Kang, shared a case in the book involving MQ servers and a load balancer.

<p align="center">
    <img src="https://i.imgur.com/zgECd9A.png">
</p>
<p align="center">
    <em>Figure 18. How a load balancer works (DSR)</em>
</p>

The figure can be summarized as follows:

1. A client sends a connection establishment request to the load balancer (LB)
2. The load balancer establishes a connection with the MQ (1010.10.11), then records the client IP/port and server IP/port in its session table
3. The MQ, having received the connection request from the load balancer, responds with a `SYN+ACK` packet directly to the client

In the figure, the `SYN+ACK` goes directly to the client without passing through the load balancer — because most load balancers follow the DSR (Direct Server Return)[^17] method.

At a glance this looks fine. But the session table cannot grow indefinitely; it is flushed at regular intervals. That interval is the Idle Timeout.
This Idle Timeout can cause a problem: the session table entry may have been erased while the client makes another request. In that case, per the load balancer's round-robin policy, the request may land on a new server.

That situation looks like this:

<p align="center">
    <img src="https://i.imgur.com/UZfDqIs.png">
</p>
<p align="center">
    <em>Figure 19. The problem that can occur when client info evaporates from the session table</em>
</p>

The request was delivered to a different MQ, not the original one — and since this MQ has not done a handshake, it considers the packet abnormal and sends an RST packet.

If, by sheer luck, the client gets connected to the MQ it was originally connected to, there may be no problem; otherwise, the client experiences a timeout.

When this problem occurs, the client opens a new connection to a new server. However, **the server that was connected to the original client has no way of knowing about this behavior, and so zombie connections pile up in large numbers.**

So how can this be solved? We already covered the solution while discussing zombie connections: the **TCP keep-alive option.**

The author, Jinwoo Kang, says the load balancer's Idle Timeout was 120 seconds, and he solved the case by adjusting the parameters so the keep-alive timeout would be detected within those 120 seconds.

### STEP 3.4 TCP Retransmission and Timeouts

Now for the last TCP topic: retransmission and timeouts.

When can TCP packet loss occur? There are two answers to this question:

1. During connection establishment
2. During communication after establishment

TCP, unlike UDP, is often called a **reliable protocol.**

Readers of this post probably know this concept already. To guarantee this reliability, after a request, an `ACK` is sent to signal that the request arrived correctly.

But what happens when this `ACK` is lost? The request is retransmitted. So there must be a criterion for how long to wait — what is it?

We touched on this while covering `net.ipv4.tcp_tw_recycle`: the RTO (Retransmission Timeout)[^14].

There are two kinds of RTO:

1. The threshold for receiving an `ACK` before connection establishment: InitRTO (set to 1 second per [RFC6298](https://datatracker.ietf.org/doc/html/rfc6298))
2. The threshold for receiving an `ACK` after connection establishment: the regular RTO

That is, to detect packet loss before connection establishment, since InitRTO is set to 1 second, you must wait at least 1 second to detect the loss.
So how is the regular RTO determined? This is well described in [RFC6298](https://datatracker.ietf.org/doc/html/rfc6298) 2.2.

Once an RTT is measured, it is processed as follows:

$$
\begin{matrix}
given\quad First\,RTT\,mesaurement = R\\ 
given\quad Clock\,Granularity = G\\\\  
SRTT \Leftarrow R  \\
RTTVAR \Leftarrow \frac{R}{2} \\\\
RTO = SRTT + max(G, K * RTTVAR)
\end{matrix} 
$$

If you want to know more about this formula, see [Colby College - Computer Science, Transport Layer](https://cs.colby.edu/courses/F19/cs331/notes/6.TransportLayer(4).pdf).

Based on these values TCP retransmits, and after the initial retransmission, TCP retransmits using exponential backoff[^18].

Exponential backoff follows a formula like $RTO = q * RTO$, where q is usually set to 2.

So if the RTO was 200ms, it grows progressively: $200 \Rightarrow 400 \Rightarrow 800 \Rightarrow 1600$. Does the retransmission count grow without limit, then? We can check via kernel parameters.

Exponential backoff is a very widely used approach for handling retry intervals like this; if you want to know why, see the link below.
+ [On retry strategies (Exponential Backoff, Jitter) - Random Access Memories (Korean)](https://jungseob86.tistory.com/12)

#### STEP 3.4.1 TCP Retransmission Kernel Parameters

```sh
sudo sysctl -a | grep -i retries
net.ipv4.tcp_orphan_retries = 0
net.ipv4.tcp_retries1 = 3
net.ipv4.tcp_retries2 = 15
net.ipv4.tcp_syn_retries = 6
net.ipv4.tcp_synack_retries = 5
```

These are the kernel parameters related to retransmission.

1. `net.ipv4.tcp_orphan_retries`: defines the maximum retransmission count for `FIN` packets on sockets in the `FIN_WAIT1` state
2. `net.ipv4.tcp_retries1`: the threshold for signaling the IP layer to check whether the network is wrong (soft threshold)
3. `net.ipv4.tcp_retries2`: the threshold for deciding communication is no longer possible (hard threshold)
4. `net.ipv4.tcp_syn_retries`: defines the maximum retransmission count for `SYN` packets during initial connection establishment
5. `net.ipv4.tcp_synack_retries`: defines the maximum retransmission count for the `SYN + ACK` responding to the peer's `SYN` packet

Here, `net.ipv4.tcp_orphan_retries` deserves a separate look.

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

`tcp_orphan_retries()` is the function actually called when reprocessing `FIN_WAIT1`. The important condition is `retries == 0 && alive`: `alive` indicates whether data was sent recently, and if it is 1, then even if the parameter is set to 0, there will be 8 retries.

Looking at `tcp_write_timout()`, you can see where the `alive` value is computed: it is declared `true` when the RTO is smaller than `TCP_RTO_MAX`.

For reference, `TCP_RTO_MAX` is 120 seconds, and `TCP_RTO_MIN` is 1 second (1000ms) / 5, i.e., 200ms.

Application timeouts should be configured with these values in mind.

If you set an application timeout under 1 second for the initial connection establishment phase, it would be smaller than `InitRTO`, and if packet loss occurs, you will hit timeout problems.

Likewise, after connection establishment, setting the timeout lower than `TCP_RTO_MIN` also prevents the retransmission mechanism from being used properly.

Therefore, you should configure timeouts considering the average request/response latency from your monitoring tools together with these kernel parameter values — only then can the TCP retransmission mechanism be properly utilized.

## STEP 4. Conclusion

I originally intended to split this into two posts, but out of laziness I kept writing and it became a very long post.
I ask for your generous understanding.

This post covered:

1. What sockets are and their types
2. The actual socket creation mechanism through kernel code analysis
3. The TCP socket connection establishment/teardown process through kernel code analysis
4. The TCP socket message send/receive process through kernel code analysis
5. Various problems you can encounter using TCP, and the related kernel parameters

I hope this foundational knowledge helps resolve problems you face in real services, or satisfies your curiosity about TCP and sockets.

## References

1. [Beej's Guid to Network Programming](https://www.beej.us/guide/bgnet/)
2. [Networking - Linux Kernel Labs](https://linux-kernel-labs.github.io/refs/heads/master/labs/networking.html)
3. [Linux Kernel Networking, Sockets in the kernel - haifux.org](http://www.haifux.org/lectures/217/netLec5.pdf)
4. [TCP/IP Networking - Columbia Univ](https://cs3157.github.io/www/2022-9/lecture-notes/13-tcp-ip.pdf)
5. [Message Traffic Overview - New Hampshire Univ](https://www.cs.unh.edu/cnrg/people/gherrin/linux-net.html#tth_chAp2)
6. [System Programming, TCP in Linux - Korea Univ](https://os.korea.ac.kr/wp-content/uploads/2020/11/10_TCP-in-Linux.pdf)

## Further Reading
1. [Understanding the TCP/IP network stack - Naver D2 (Korean)](https://d2.naver.com/helloworld/47667)
2. [The definitive analysis of CLOSE_WAIT & TIME_WAIT - Kakao Tech (Korean)](https://tech.kakao.com/2016/04/21/closewait-timewait/)
3. [On retry strategies (Exponential Backoff, Jitter) - Random Access Memories (Korean)](https://jungseob86.tistory.com/12)
4. [TCP retransmission and tuning points - Jinwoo Kang (Korean)](https://brunch.co.kr/@alden/15)

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
