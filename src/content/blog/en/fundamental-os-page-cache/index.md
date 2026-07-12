---
title: Why Do Throughput-Critical JVM Applications Set vm.swappiness = 1?
date: 2023-06-19 19:40:00 +0900
tags:
  - Operating System
  - JVM
  - Fundamental
emoji: 💻
author: 개발한입
categories: 개발 인프라
---

> 🤖 **Note**: This post was machine-translated from the [Korean original](/fundamental-os-page-cache/). It may contain awkward phrasing or minor translation errors. If anything is unclear, please refer to the original or leave a comment below.

```toc
```

- STEP 1. Introduction
  - STEP 1.1 A Story from the Past
  - STEP 1.2 Aside) If You Use NVMe as Swap Space, Is It as Fast as RAM?
- STEP 2. Main Discussion
  - STEP 2.1 The OS Cache Area and Swapping
    - STEP 2.1.1 The Cache Area
    - STEP 2.1.2 Swapping
    - STEP 2.1.3 How the OS Reclaims Memory
  - STEP 2.2 Java, the Page Cache, and Garbage Collection
    - STEP 2.2.1 The Page Cache and Dirty Page Synchronization
    - STEP 2.2.2 Java Memory and Garbage Collection
- STEP 3. Conclusion
- STEP 4. References

# STEP 1. Introduction

While reading *Kafka: The Definitive Guide*, a question came to mind in the "OS Tuning" section of Chapter 1 (p.40).

> For most applications, especially those where throughput matters, it is best to avoid swapping at (almost) all costs.
>
> -Kafka: The Definitive Guide, p.40-

Naturally, since virtual memory supported at the OS level is not real memory but a way of temporarily using the disk as if it were memory, it made sense to me that **throughput-critical** applications should avoid it. But I became curious about exactly *why*.

This guidance is documented not only for Kafka but also for Elasticsearch.
+ [Disable swapping - Elasticsearch Guide 8.8](https://www.elastic.co/guide/en/elasticsearch/reference/current/setup-configuration-memory.html)

So I decided to dig into this topic and write it up.

Of course, I will assume that readers have a basic understanding of swap (virtual memory). If you are not familiar with it, please refer to other blogs or resources first.

## STEP 1.1 A Story from the Past

As I recall, it has already been about 10 years since I first installed Linux myself. Back then, most blogs gave guidance on swap space like this:

> Allocate swap space at about twice the size of your RAM.

I suspect this originated from the official Red Hat guide and was passed down by word of mouth, diluted over time into "allocate twice the system's memory."

Below is the current RHEL 9 guidance on swap space.

<p align="center">
    <img src="https://i.imgur.com/5q8qYzf.png">
</p>
<p align="center">
    <em>Figure 1. <a href="https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/managing_storage_devices/getting-started-with-swap_managing-storage-devices">RHEL Recommended System Swap Space</a></em>
</p>

As a student, I used swap memory without really understanding it, so rather than following guides like the one above, I remember simply setting it to twice the RAM size because that was the common advice.

But in today's environment where physical memory (RAM) has become cheap, I started to wonder: do we even need swap anymore?

You can find many Q&A threads on this topic on 2cpu, a Korean community with many server engineers.

1. [Ubuntu Swap partition size - 2cpu (Korean)](https://www.2cpu.co.kr/QnA/477563#c_477565)
2. [How do you size Linux swap space these days with large memory? - 2cpu (Korean)](https://www.2cpu.co.kr/bbs/board.php?bo_table=QnA&wr_id=556001)

The first question was posted in 2015 and the second in 2016.

For the first question, the answer by Hangu Kim was memorable:

> Swap partitions were created back when physical memory was scarce, to use the hard disk like memory. With 128 GB of memory you are unlikely to run short, so it seems unnecessary. However, if you don't configure swap you may get warning messages, so allocating roughly 2–4 GB should be enough.

This is very similar to the Red Hat guidance.

For the second question, two answers stood out.

+ User "Kkangtong":

> There are two advantages to using swap:
> 1. With swap, when you use more than the physical memory, the system slows down instead of crashing.
> 2. With swap, the OS can move rarely used memory regions to swap and use the freed space as disk cache.
>
> If you dislike the slowdown from swap but want it for reason #1, allocate a modest amount and set vm.swappiness between 0 and 10 so that physical memory is used as much as possible.

+ User "Park":

> It also depends on the application.
> Oracle sometimes recommends three times the memory, and in special cases some applications require swap space at least the size of memory in order to dump memory contents.

Another commenter mentioned hibernation as a reason for using swap; see [Ubuntu Linux Hibernation - kwonnam (Korean)](https://kwonnam.pe.kr/wiki/linux/ubuntu/hibernation) for details. Hibernation appears to make use of the swap area when it runs.

Putting it all together, we can draw the following conclusions:

+ You can size swap appropriately based on available physical memory and application usage.
	+ If you determine it is unnecessary, you can skip configuring it entirely.
+ If you do configure swap, exceeding physical RAM will slow things down but can prevent the system from going down.

## STEP 1.2 Aside) If You Use NVMe as Swap Space, Is It as Fast as RAM?

Some might think:

> If I use NVMe, it's almost as fast as RAM, right? So if I install an NVMe drive and use it as swap, isn't that effectively the same as adding more RAM?

It is true that NVMe has caught up with DDR2 speeds. However, DDR4 typically runs at 20 GB/s, while NVMe uses four PCIe lanes, which at PCIe 3.0 gives about 8 GB/s.

Of course, things change with more lanes (16 instead of 4) or with PCIe 4.0. But as of this writing, RAM has entered the DDR5 era, and articles comparing PCIe 3.0 vs PCIe 4.0 show the performance difference is marginal.

Reference: [NVMe 'PCIe 3.0 vs PCIe 4.0' performance? Huh, no difference (Korean)](http://www.weeklypost.kr/news/articleView.html?idxno=4258)

Moreover, the assumption above only considers **sequential reads and writes**. One of the most important capabilities of RAM is **random access** — and when compared on random access, **NVMe is incomparably slower than even ancient SDRAM.**

Still, NVMe or SSD is far faster than HDD, so it is worth using for swap. In the past, SSDs had very short lifespans, so using them for swap wore them out quickly. But according to the [JEDEC Standards](https://www.jedec.org/standards-documents/focus/flash/solid-state-drives), this is no longer a major concern with modern SSDs.

# STEP 2. Main Discussion

We covered the historical background above. The cases for using swap can be summarized as:

+ You can size swap appropriately based on available physical memory and application usage.
	+ If you determine it is unnecessary, you can skip configuring it entirely.
+ If you do configure swap, exceeding physical RAM will slow things down but can prevent the system from going down.

From these two conclusions, we can see that swap is slower than memory, but it can prevent the worst-case scenario when no memory is available.

Now let's get to the real question: why set `vm.swappiness = 1`?
We need to look at two levels — first the **operating system level**, then the **JVM level**.

Since we first need to talk about the OS cache, let's start there.

## STEP 2.1 The OS Cache Area and Swapping

### STEP 2.1.1 The Cache Area

The OS kernel reads and writes data from disk through block devices[^1]. Naturally, this is expensive because it goes through the disk.

So the kernel sets aside part of memory as a cache area[^2], storing disk contents that have been read once. When the same content is requested again, instead of issuing a read to the disk, the kernel first checks whether the value exists in the cache area and fetches it from there.

<p align="center">
    <img src="https://i.imgur.com/cx5KQtU.png">
</p>
<p align="center">
    <em>Figure 2. How data is loaded into the cache area</a></em>
</p>

The figure above illustrates this. In a real application load scenario, memory usage evolves as follows:

<p align="center">
    <img src="https://i.imgur.com/ddqF2a0.png">
</p>
<p align="center">
    <em>Figure 3. Changes in available memory after application load</a></em>
</p>

1. Initially there is memory in use and available (free) memory.
2. Over time, data accumulates in the cache area.
3. The application gradually uses more and more memory.
4. As the memory in use grows, part of the cache area is handed over for the application to use.

During this process, available memory may run out — and if a swap area exists, swap gets used.

So how does using swap actually work?

### STEP 2.1.2 Swapping

<p align="center">
    <img src="https://i.imgur.com/8BNaTLn.png">
</p>
<p align="center">
    <em>Figure 4. How swapping works</a></em>
</p>

Swapping at the OS level works as shown above.

Looking at the figure, you might wonder:

> Why is a whole process being placed on disk?

Figure 4 shows the classic OS notion of swapping. However, virtual memory (the swap area) **swaps at the granularity of pages, not whole processes.**

The cache area shown in Figure 2 is actually managed through the page cache[^3], which we will cover later. For now, just think of it as: **when swapping moves data from the cache area to the swap area, that data is written to disk.**

If you want to dig deeper into this, see the link below.
+ [What are OS swapping and virtual memory? (Korean)](https://resilient-923.tistory.com/397)

As shown in Figure 4, swapping involves two operations:
+ **Swap-out**: moving infrequently used data from memory to the swap area
+ **Swap-in**: bringing data back from disk when swapped-out data needs to be read again

As mentioned in the introduction, **disk I/O is expensive.**

And the biggest problem is this: as in Figure 3, **we expect swapping to occur only when the application's usage grows and free memory runs short — but that is not how it actually behaves.**

> In other words, swapping can occur even when the cache area and free memory have plenty of room.

To understand this, we need to understand how the operating system reclaims memory.

### STEP 2.1.3 How the OS Reclaims Memory

**The Linux kernel does not like memory sitting idle.** Figure 3 illustrates exactly this. The kernel avoids idle memory by making use of the cache area, and as the system runs this way, available memory keeps shrinking. **Identifying unused memory and reassigning it where needed is called memory reclamation** (memory reallocation).

Looking at step 4 of Figure 3, you can see the cache area shrink and the in-use area grow — **during memory reclamation, the cache area is primarily released, and swapping also occurs.**

**That is, when there is no free memory, the kernel looks for reclaimable memory among what is in use and releases it.**

This is where the `vm.swappiness` kernel parameter comes into play.

<p align="center">
    <img src="https://i.imgur.com/AMImeT5.png">
</p>
<p align="center">
    <em>Figure 5. How memory reclamation works</em>
</p>

Figure 5 is a simplified illustration of the memory reclamation process described above.

Earlier I said swapping can occur even when the cache area or free memory has room — the reason is that the behavior differs depending on the `vm.swappiness` value.

This kernel parameter determines **how aggressively the kernel moves memory to the swap area.** If the value is high, the swap area gets used even when the cache area still has room. That leads to unnecessary swapping and disk I/O, which hurts performance.

So the reason throughput-critical applications set `vm.swappiness = 1` is **to reduce unnecessary swapping during memory reclamation, preferring to evict the cache area as much as possible before using swap.**

There is even a formula that computes this ratio, called Swap Tendency:

```
swap_tendency = mapped_ratio/2 + distress + vm_swappiness;
```

This goes beyond the scope of this post; if you want the details of reclamation and this parameter, see the link below.
+ [Memory reclamation and kernel parameters - Jinwoo Kang (Korean)](https://brunch.co.kr/@alden/14)

Incidentally, the same author kindly explains why we set it to 1 rather than 0:

> However, [with 0] far more page cache gets released than with 1.
> It flushes it down to nearly single digits, so if you want a system with more stable performance, setting it to 1 is a good idea.
>
> Discarding too much page cache can increase I/O and drive up system load.

As for why discarding the entire page cache increases I/O, I will explain that while covering the JVM level.

## STEP 2.2 Java, the Page Cache, and Garbage Collection

Above, we covered the topic at the operating system level. We could stop there, but I was curious whether `vm.swappiness` has any relationship with the JVM.

After all, both Kafka and Elasticsearch run on the JVM.

This section is not an internal analysis of the JVM either. Building on the foundation above, I will go into more detail and describe the practical impact.

But first, we need to understand the page cache.

### STEP 2.2.1 The Page Cache and Dirty Page Synchronization

In fact, both the cache area in Figure 2 and the one in Figure 5 can be equated with the page cache.

We learned above that the operating system works by **keeping data that has been read once in the page cache to reduce disk I/O.**

Then some readers may wonder:

> What happens when a page loaded in the page cache gets modified?

If you use JPA, you have probably heard the term dirty checking[^4].

<p align="center">
    <img src="https://i.imgur.com/JsiNr2f.png">
</p>
<p align="center">
    <em>Figure 6. Dirty checking, from "Java ORM Standard JPA Programming" by Younghan Kim</em>
</p>

Briefly: think of the first-level cache as the page cache, and the state of previously loaded entries as a snapshot. The entity manager then compares against the snapshot and performs updates.

The operating system behaves similarly. A page that was loaded into the page cache and has since been modified is called a dirty page[^5].

The detection and handling work as follows:

<p align="center">
    <img src="https://i.imgur.com/2IXA7Yc.png">
</p>
<p align="center">
    <em>Figure 7. Dirty page detection and synchronization</em>
</p>

1. Assume data A, B, and C are in the page cache and already persisted to disk.
2. B changes to D in the page cache. This is not immediately written to disk; the page cache holds the dirty page.
3. When certain conditions are met, the dirty page is flushed to disk.

**Writing dirty pages from the page cache to disk is called dirty page synchronization.**

This leads to the following trade-off:
+ If the synchronization condition is very short → frequent disk I/O every time a dirty page is created
+ If the synchronization condition is very long → dirty pages pile up in the page cache, and if the server goes down, all that data is lost

Once again, **there is no silver bullet.** But since we are talking about throughput-critical JVM applications, the focus leans toward reducing disk I/O.

The kernel parameters controlling synchronization frequency and conditions include:

```
vm.dirty_backgroud_ratio 
vm.dirty_ratio 
... etc ...
```

For a deeper look, see:
+ [Dirty page synchronization #1 - Jinwoo Kang (Korean)](https://brunch.co.kr/@alden/32)

### STEP 2.2.2 Java Memory and Garbage Collection

Everything so far has been building up to this section. Now I will bring it all together using Kafka and Elasticsearch as examples.

As a Java developer, you might think:

> Swap, page cache — this is all such a hassle. Why not just manage it in-memory in Java? The GC takes care of it anyway, right? lol

But both Kafka and Elasticsearch deliberately use the operating system's page cache. Why?
The answer is in the [Kafka official documentation](https://docs.confluent.io/kafka/design/file-system-constant-time.html#ak-and-the-jvm):

>  Kafka is built on top of the JVM, and Java memory usage has the following characteristics:
>  1. The memory overhead of objects is very high, often doubling the size of the data stored (or worse).
>  2. Java garbage collection becomes increasingly slow as the in-heap data increases.

In other words, because of these two characteristics, they were designed to use the OS page cache instead of a cache managed in Java memory. The biggest advantage of this design is reducing the **GC penalty**.

Either way, stop-the-world (STW) happens at the moment of GC. If GC kicks in while a huge amount of data is loaded in memory — and if it's a Full GC — the STW pause freezing the application will be very long.

Another advantage: consider an application restart. If we had managed the cache in Java memory, the cache would evaporate the moment we restart, and warming it up again would take considerable time.

But if the cache is managed by the OS page cache, it exists independently of whether the application is running, so the warm-up cost is much lower.

There is an interesting related issue here:
+ [Java process takes a long time with -XX:+AlwaysPreTouch - Red Hat Customer Portal](https://access.redhat.com/solutions/2685771)

Briefly, the `-XX:+AlwaysPreTouch` option zero-fills the heap upfront when the heap size is large — boot becomes slower, but runtime becomes faster. In short, it **reduces warm-up cost.**

With this option, the entire heap up to Xmx (the maximum heap size) is touched with zeros. In this case, instead of the page cache being allocated gradually as we saw in Figure 3, pages are requested from the OS right at application startup.

That request for pages from the free memory area triggers the memory reclamation process.

Now think about what follows. Pages were created by requesting memory from the OS, and since the pages already exist, every data change creates dirty pages.

Now suppose free memory runs short and reclamation kicks in. Since a large amount of page cache has already been created, reclamation will be that much slower — and if the dirty-page kernel parameters were not separately tuned, heavy disk I/O will occur as well.

We can infer that the issue above was slow for exactly this reason.

So now we understand why JVM applications with high-throughput requirements use the OS page cache: it is tied to the characteristics of Java memory.

Then why must swap be avoided? This is actually related to GC.
Assume the following situation:

<p align="center">
    <img src="https://i.imgur.com/MZw7rIs.png">
</p>
<p align="center">
    <em>Figure 8. Objects in the Java heap that are unreachable but not yet collected</em>
</p>

1. Data B, A, and C were allocated and loaded into the page cache.
2. B, A, and C are no longer used by the Java application, but they have not yet been collected by the GC.

We learned about swap-out and swap-in above: pages in the page cache that are not frequently used get moved to the swap area.

So we can predict the following:

<p align="center">
    <img src="https://i.imgur.com/LeJbSEA.png">
</p>
<p align="center">
    <em>Figure 9. The OS swaps out first, causing disk I/O when GC actually runs</em>
</p>

Pages that were swapped out to the swap area must be swapped back in when the JVM triggers GC and needs to examine them.

In other words, **STW can become extremely long.** This is why JVM applications minimize their use of the swap area.

# STEP 3. Conclusion

This turned out to be a long post. To summarize:

1. Disk I/O through virtual memory is still slow compared to RAM, even with SSD or NVMe.
2. Because of #1, swapping the OS page cache is a very expensive operation.

Nevertheless, Java applications with high-throughput requirements use the page cache, because:

1. The GC penalty of Java memory is very large.
2. On application restart, there are data-loss concerns and extra work such as cache warm-up.

Even so, swapping can cause problems with disk I/O and GC, so the preferred approach is to minimize it even when it is used.

Thank you for reading this long post.

## STEP 3.1 P.S.

What prompted me to write this up was the following post:
+ [Just say no to swapping! - Michael McCandless](https://blog.mikemccandless.com/2011/04/just-say-no-to-swapping.html)

However, that post was written in 2011 (around the Java 7 era).
Yet the diagram I drew in the conclusion is structured like G1GC regions.

I have not actually verified this myself, but I drew the diagram inferring that the same problem could still occur today. Is that inference reasonable?

1. [Memory and JVM Tuning - GridGain Doc](https://www.gridgain.com/docs/latest/perf-troubleshooting-guide/memory-tuning#tune-swappiness-setting)

The guide above states:

> The value of this setting can prolong GC pauses as well. 
> For instance, if your GC logs show low user time, high system time, long GC pause records, it might be caused by Java heap pages being swapped in and out. To address this, use the swappiness settings above.

So it indicates that actual GC time can indeed be slowed down by swap-in/out.

2. [Design of Swap-aware Java Virtual Machine Garbage Collector Policy](https://www.slideshare.net/HyojeongLee6/paperdesign-of-swapaware-java-virtual-machine-garbage-collector-policy)

The link above is a summary slide deck of a paper on the impact of system swap during JVM GC and a proposed solution.

I have not read the paper itself, but judging from the slides it seems to target Parallel GC rather than G1GC (mark-and-summary compaction is described later in the deck). Either way, it indicates a clear impact between GC and the swap area.

3. [Tuning Java applications on Linux](https://www.mastertheboss.com/java/tuning-java-applications-on-linux/)

This link provides a script to check whether your Java application is currently using swap, and explains what to do when swap is identified as a bottleneck.

Given these various cases, it looks like this applies to G1GC as well. If I find the time, I will add a verification of this.

# STEP 4. References

1. [If you have a super fast NVMe M.2 SSD for virtual memory (caching, or swap files), do you still need a lot of physical RAM?](https://www.quora.com/If-you-have-a-super-fast-NVMe-M-2-SSD-for-virtual-memory-caching-or-swap-files-do-you-still-need-a-lot-of-physical-RAM)
2. [Why are swap partitions discouraged on SSD drives, are they harmful?](https://askubuntu.com/questions/652337/why-are-swap-partitions-discouraged-on-ssd-drives-are-they-harmful)
3. [Ubuntu Linux Hibernation (Korean)](https://kwonnam.pe.kr/wiki/linux/ubuntu/hibernation)
4. [What are OS swapping and virtual memory? (Korean)](https://resilient-923.tistory.com/397)
5. [Memory reclamation and kernel parameters - Jinwoo Kang (Korean)](https://brunch.co.kr/@alden/14)
6. [Just say no to swapping! - Michael McCandless](https://blog.mikemccandless.com/2011/04/just-say-no-to-swapping.html)
7. [Elasticsearch caching deep dive: Boosting query speed one cache at a time - elastic.co](https://www.elastic.co/blog/elasticsearch-caching-deep-dive-boosting-query-speed-one-cache-at-a-time)
8. [Dirty page synchronization #1 - Jinwoo Kang (Korean)](https://brunch.co.kr/@alden/32)
9. [Memory and JVM Tuning - GridGain Doc](https://www.gridgain.com/docs/latest/perf-troubleshooting-guide/memory-tuning#tune-swappiness-setting)
10. [Design of Swap-aware Java Virtual Machine Garbage Collector Policy](https://www.slideshare.net/HyojeongLee6/paperdesign-of-swapaware-java-virtual-machine-garbage-collector-policy)
11. [Tuning Java applications on Linux](https://www.mastertheboss.com/java/tuning-java-applications-on-linux/)

[^1]: [Block Devices - Wikipedia](https://en.wikipedia.org/wiki/Device_file#Block_devices)
[^2]: [Disk cache - Wikipedia](https://en.wikipedia.org/wiki/Disk_cache)
[^3]: [Page cache - Wikipedia](https://en.wikipedia.org/wiki/Page_cache)
[^4]: [What is Dirty Checking? - jojoldu (Korean)](https://jojoldu.tistory.com/415)
[^5]: [What are dirty pages? - lemp.io](https://lemp.io/what-is-a-dirty-page-in-operating-system/)
